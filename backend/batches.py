"""Stock batches: expiry dates per delivery and first-expired-first-out (FEFO) consumption.

Ingredient.stock_level is still the number every other part of the system reads. This module keeps
the active batches' quantity_remaining summing to it, and decides which batch each deduction comes from:

  1. batches with no recorded expiry (opening stock and manual adjustments), oldest first,
  2. then unexpired batches, soonest expiry first,
  3. expired batches last. Those should be discarded, not used, so the portals flag them.
"""
import re
from datetime import date, datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import func, inspect
from sqlalchemy.exc import IntegrityError, ProgrammingError

from models import db, Ingredient, StockBatch, StockInLog, StoreSettings, _add_column

bp = Blueprint('batches', __name__)

EPS = 1e-9
DISCARD_REASONS = ('Expired', 'Spoiled', 'Damaged', 'Other')


def store_today():
    from daily_report import store_tz
    return datetime.now(store_tz(StoreSettings.current())).date()


def parse_expiry(value):
    """'YYYY-MM-DD' to a date. Raises ValueError with a message fit for the portals."""
    if value in (None, ''):
        raise ValueError('Enter an expiry date for every batch')
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        raise ValueError(f'"{value}" is not a valid expiry date')


def _usable_order_key(today):
    def key(b):
        # 0. Active unexpired batches with expiry date: earliest expiry date first (FEFO)
        # 1. Active batches with no expiry date: oldest received_at first (FIFO)
        # 2. Expired batches last (never consumed for orders)
        if b.expiry_date is not None:
            if b.expiry_date >= today:
                return (0, b.expiry_date, b.received_at or datetime.min, b.id or 0)
            else:
                return (2, b.expiry_date, b.received_at or datetime.min, b.id or 0)
        else:
            return (1, date.max, b.received_at or datetime.min, b.id or 0)
    return key


def active_batches(ingredient):
    return [
        b for b in ingredient.batches
        if b.disposed_at is None and (b.quantity_remaining or 0) > EPS
    ]


def fefo_order(batches, today):
    return sorted(batches, key=_usable_order_key(today))


def _take_from_batches(ingredient, qty, today):
    remaining = qty
    for batch in fefo_order(active_batches(ingredient), today):
        if remaining <= EPS:
            break
        # Do not draw from expired batches
        if batch.expiry_date is not None and batch.expiry_date < today:
            continue
        take = min(batch.quantity_remaining, remaining)
        batch.quantity_remaining = round(batch.quantity_remaining - take, 6)
        remaining -= take


def _adjustment_batch(ingredient, qty, source='adjustment', by=None):
    batch = StockBatch(
        ingredient=ingredient,
        batch_code=next_batch_code(ingredient, prefix='ADJ' if source == 'adjustment' else 'OPEN'),
        quantity_received=round(qty, 6),
        quantity_remaining=round(qty, 6),
        expiry_date=None,
        source=source,
        received_by=by,
        received_at=datetime.utcnow(),
    )
    db.session.add(batch)
    return batch


def recalculate_stock(ingredient, today=None):
    """Recalculate ingredient.stock_level from all non-expired, active batch quantities."""
    today = today or store_today()
    if ingredient.batches:
        valid_total = sum(
            float(b.quantity_remaining or 0)
            for b in ingredient.batches
            if b.disposed_at is None
            and (b.quantity_remaining or 0) > EPS
            and (b.expiry_date is None or b.expiry_date >= today)
        )
        ingredient.stock_level = round(max(0.0, valid_total), 6)
    return float(ingredient.stock_level or 0)


def consume(ingredient, qty, today=None):
    """Deduct qty from the ingredient (clamped at 0), drawing from batches FEFO."""
    qty = max(0.0, float(qty or 0))
    if qty <= EPS:
        return
    today = today or store_today()
    _take_from_batches(ingredient, qty, today)
    recalculate_stock(ingredient, today)


def restore(ingredient, qty, today=None):
    """Put qty back (e.g. an approved request is un-approved), refilling batches it most likely came from."""
    qty = max(0.0, float(qty or 0))
    if qty <= EPS:
        return
    today = today or store_today()
    left = qty
    candidates = [
        b for b in ingredient.batches
        if b.disposed_at is None
        and (b.expiry_date is None or b.expiry_date >= today)
        and b.quantity_received - b.quantity_remaining > EPS
    ]
    for batch in fefo_order(candidates, today):
        if left <= EPS:
            break
        room = batch.quantity_received - batch.quantity_remaining
        give = min(room, left)
        batch.quantity_remaining += give
        left -= give
    if left > EPS:
        _adjustment_batch(ingredient, left)
    recalculate_stock(ingredient, today)


def reconcile(ingredient, by=None, today=None):
    """Make the active batches add up to stock_level after it was set directly (manual edit, new ingredient)."""
    today = today or store_today()
    tracked = sum(
        b.quantity_remaining for b in ingredient.batches
        if b.disposed_at is None
        and (b.quantity_remaining or 0) > EPS
        and (b.expiry_date is None or b.expiry_date >= today)
    )
    diff = float(ingredient.stock_level or 0) - tracked
    if diff > 1e-6:
        _adjustment_batch(ingredient, diff, by=by)
    elif diff < -1e-6:
        _take_from_batches(ingredient, -diff, today)
    recalculate_stock(ingredient, today)


def _code_prefix(name):
    words = re.findall(r'[A-Za-z0-9]+', name or '')
    if not words:
        return 'LOT'
    if len(words) == 1:
        return words[0][:2].upper() if len(words[0]) >= 2 else words[0].upper()
    return ''.join(w[0] for w in words[:3]).upper()


def next_batch_code(ingredient, prefix=None, taken=None):
    """e.g. WM-20261012-01 for Whole Milk received on 2026-10-12."""
    stem = f'{prefix or _code_prefix(ingredient.name)}-{store_today():%Y%m%d}-'
    existing = {b.batch_code.upper() for b in ingredient.batches} | {c.upper() for c in (taken or ())}
    n = 1
    while f'{stem}{n:02d}'.upper() in existing:
        n += 1
    return f'{stem}{n:02d}'


def _code_in_use(ingredient_id, code, exclude_id=None):
    q = StockBatch.query.filter(
        StockBatch.ingredient_id == ingredient_id,
        func.lower(StockBatch.batch_code) == code.lower(),
    )
    if exclude_id is not None:
        q = q.filter(StockBatch.id != exclude_id)
    return db.session.query(q.exists()).scalar()


def build_batches(ingredient, rows, today):
    """Validate the batch rows of a stock-in. Returns [(qty, code, expiry)] or raises ValueError."""
    if not rows:
        raise ValueError('Add at least one batch with its quantity and expiry date')
    parsed, codes = [], set()
    for i, row in enumerate(rows, start=1):
        label = f'Batch {i}' if len(rows) > 1 else 'The batch'
        try:
            qty = float(row.get('quantity'))
        except (TypeError, ValueError):
            raise ValueError(f'{label} needs a quantity')
        if qty <= 0:
            raise ValueError(f'{label} quantity must be greater than zero')
        expiry = parse_expiry(row.get('expiry_date'))
        if expiry < today:
            raise ValueError(f'{label} expired on {expiry:%b %d, %Y}. Expired stock cannot be received.')
        code = (row.get('batch_code') or '').strip()[:60]
        if code:
            if code.upper() in codes:
                raise ValueError(f'Batch ID "{code}" is used twice in this delivery')
            if _code_in_use(ingredient.id, code):
                raise ValueError(f'Batch ID "{code}" already exists for {ingredient.name}')
        else:
            code = next_batch_code(ingredient, taken=codes)
        codes.add(code.upper())
        parsed.append((qty, code, expiry))
    return parsed


def ensure_batch_schema():
    """Create stock_batches on existing databases and give current stock an opening batch."""
    try:
        StockBatch.__table__.create(db.engine, checkfirst=True)
    except (ProgrammingError, IntegrityError):
        pass  # created by a concurrent worker
    insp = inspect(db.engine)
    if insp.has_table('stock_in_logs'):
        columns = {col['name'] for col in insp.get_columns('stock_in_logs')}
        if 'received_by' not in columns:
            with db.engine.begin() as conn:
                _add_column(conn, 'stock_in_logs', 'received_by', 'VARCHAR(100)')
    if not insp.has_table('ingredients'):
        return
    today = store_today()
    changed = False
    for ing in Ingredient.query.all():
        if float(ing.stock_level or 0) <= EPS and not ing.batches:
            continue
        before = len(ing.batches)
        if not ing.batches:
            _adjustment_batch(ing, float(ing.stock_level), source='opening')
        else:
            reconcile(ing, today=today)
        recalculate_stock(ing, today)
        changed = True
    if changed:
        db.session.commit()


# ----------------- ROUTES -----------------

def _batches_payload(batches, today):
    by_ingredient = {}
    for b in batches:
        by_ingredient.setdefault(b.ingredient_id, []).append(b)
    out = []
    for group in by_ingredient.values():
        live = [b for b in group if b.disposed_at is None and b.quantity_remaining > EPS]
        rank = 0
        ranks = {}
        for b in fefo_order(live, today):
            if b.expiry_date is not None and b.expiry_date < today:
                continue
            rank += 1
            ranks[b.id] = rank
        out.extend(b.to_dict(today, ranks.get(b.id)) for b in group)
    return out


@bp.route('/api/batches', methods=['GET'])
def list_batches():
    """Active batches by default; ?all=1 adds finished and discarded ones; ?ingredient_id= filters."""
    today = store_today()
    q = StockBatch.query
    if request.args.get('ingredient_id', type=int):
        q = q.filter(StockBatch.ingredient_id == request.args.get('ingredient_id', type=int))
    if request.args.get('all', '').lower() not in ('1', 'true', 'yes'):
        q = q.filter(StockBatch.disposed_at.is_(None), StockBatch.quantity_remaining > EPS)
    batches = q.order_by(StockBatch.expiry_date.asc().nullsfirst(), StockBatch.received_at.asc()).all()
    return jsonify(_batches_payload(batches, today))


@bp.route('/api/batches/<int:id>', methods=['PUT'])
def update_batch(id):
    """Correct a batch's ID or expiry date (e.g. a typo, or adding the date to opening stock)."""
    batch = StockBatch.query.get_or_404(id)
    data = request.json or {}
    if 'batch_code' in data:
        code = (data.get('batch_code') or '').strip()[:60]
        if not code:
            return jsonify({'error': 'Batch ID cannot be empty'}), 400
        if _code_in_use(batch.ingredient_id, code, exclude_id=batch.id):
            return jsonify({'error': f'Batch ID "{code}" already exists for {batch.ingredient.name}'}), 400
        batch.batch_code = code
    if 'expiry_date' in data:
        try:
            batch.expiry_date = parse_expiry(data.get('expiry_date'))
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    today = store_today()
    recalculate_stock(batch.ingredient, today)
    db.session.commit()
    payload = _batches_payload([b for b in batch.ingredient.batches], today)
    return jsonify(next(p for p in payload if p['id'] == batch.id))


@bp.route('/api/batches/<int:id>/discard', methods=['POST'])
def discard_batch(id):
    """Write off what is left of a batch (expired, spoiled, damaged). Takes it out of stock."""
    from notifications import safe_check_low_stock
    batch = StockBatch.query.get_or_404(id)
    if batch.disposed_at is not None:
        return jsonify({'error': 'This batch was already discarded'}), 400
    data = request.json or {}
    left = batch.quantity_remaining
    if left <= EPS:
        return jsonify({'error': 'Nothing left in this batch to discard'}), 400
    try:
        qty = float(data['quantity']) if data.get('quantity') not in (None, '') else left
    except (TypeError, ValueError):
        return jsonify({'error': 'Quantity must be a number'}), 400
    if qty <= 0 or qty > left + 1e-6:
        return jsonify({'error': f'Discard between 0 and {round(left, 3)} {batch.ingredient.unit}'}), 400
    qty = min(qty, left)
    reason = (data.get('reason') or 'Expired').strip()[:255]

    ing = batch.ingredient
    batch.quantity_remaining = round(left - qty, 6)
    batch.disposed_quantity = round((batch.disposed_quantity or 0) + qty, 6)
    batch.disposed_reason = reason
    batch.disposed_by = (data.get('by') or '').strip()[:100] or None
    if batch.quantity_remaining <= EPS:
        batch.quantity_remaining = 0.0
        batch.disposed_at = datetime.utcnow()
    today = store_today()
    recalculate_stock(ing, today)
    db.session.commit()
    safe_check_low_stock()
    return jsonify(batch.to_dict(today))
