"""Email notifications: low-stock alerts, the end-of-day report, recipients and settings.

Low-stock alerts fire once per ingredient when it drops to its reorder point and re-arm once it is
restocked above it. The end-of-day report goes out shortly after the configured closing time; a
background thread checks every 30 seconds and claims each closing with a conditional UPDATE, so a
second process (Flask's debug reloader) can never send a duplicate.
"""
import logging
import re
import threading
import time
from datetime import date, datetime, timedelta
from zoneinfo import available_timezones

from flask import Blueprint, jsonify, request
from sqlalchemy import update

from models import db, EmailLog, Ingredient, MenuItem, NotificationRecipient, StoreSettings, is_low_stock
from mailer import is_valid_email, queue_email, recipients_for, smtp_status
from email_templates import low_stock_email, test_email
from daily_report import (
    build_report, business_date, closing_for_date, latest_closing, next_closing, render_report,
    report_key, report_summary,
)

bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

TICK_SECONDS = 30
MANUAL_SEND_COOLDOWN = timedelta(seconds=15)
MAX_RECIPIENTS = 25
CLOSING_RE = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')
_TIMEZONES = None


# --------------------------------------------------------------- low stock

def paused_product_names(settings=None):
    settings = settings or StoreSettings.current()
    if not settings.auto_pause_products:
        return []
    return sorted(m.name for m in MenuItem.query.filter_by(is_available=True).all() if m.low_stock_ingredients())


def send_low_stock(newly_low, all_low, settings):
    subject, html, text = low_stock_email(
        newly_low, all_low, paused_product_names(settings), settings.auto_pause_products
    )
    return queue_email('low_stock', subject, html, text, recipients_for('low_stock'))


def check_low_stock():
    """Email about ingredients that just crossed their reorder point. Safe to call after every stock change."""
    settings = StoreSettings.current()
    now = datetime.utcnow()
    ingredients = Ingredient.query.all()
    low = [i for i in ingredients if is_low_stock(i)]

    for ing in ingredients:
        if not is_low_stock(ing) and ing.low_stock_alerted_at is not None:
            ing.low_stock_alerted_at = None  # restocked: alert again next time it runs low

    newly = []
    for ing in low:
        if ing.low_stock_alerted_at is not None:
            continue
        claimed = db.session.execute(
            update(Ingredient)
            .where(Ingredient.id == ing.id, Ingredient.low_stock_alerted_at.is_(None))
            .values(low_stock_alerted_at=now)
        )
        if claimed.rowcount == 1:
            newly.append(ing)
    db.session.commit()

    if newly and settings.low_stock_alerts_enabled:
        return send_low_stock(newly, low, settings)
    return None


def safe_check_low_stock():
    """Route hook: an email problem must never fail the order or stock change that triggered it."""
    try:
        check_low_stock()
    except Exception:
        db.session.rollback()
        logging.getLogger(__name__).exception('Low-stock check failed')


# -------------------------------------------------------------- daily report

def send_daily_report(settings, close_local):
    report = build_report(settings, close_local)
    subject, html, text = render_report(report)
    return queue_email('daily_report', subject, html, text, recipients_for('daily_report'))


def maybe_send_daily_report():
    settings = StoreSettings.current()
    close_local = latest_closing(settings)
    key = report_key(close_local)
    previous = settings.last_report_key
    if previous is not None and key <= previous:
        return None

    claimed = db.session.execute(
        update(StoreSettings)
        .where(
            StoreSettings.id == 1,
            StoreSettings.last_report_key.is_(None) if previous is None
            else StoreSettings.last_report_key == previous,
        )
        .values(last_report_key=key)
    )
    db.session.commit()
    if claimed.rowcount != 1:
        return None  # another process already handled this closing

    # First run ever: start counting from now instead of mailing a report for a day already over.
    if previous is None or not settings.daily_report_enabled:
        return None
    return send_daily_report(StoreSettings.current(), close_local)


# ----------------------------------------------------------------- scheduler

_scheduler_lock = threading.Lock()
_scheduler_started = False


def start_scheduler(app):
    global _scheduler_started
    with _scheduler_lock:
        if _scheduler_started:
            return
        _scheduler_started = True
    threading.Thread(target=_scheduler_loop, args=(app,), daemon=True, name='bb-notifications').start()


def _scheduler_loop(app):
    while True:
        with app.app_context():
            try:
                check_low_stock()
                maybe_send_daily_report()
            except Exception:
                db.session.rollback()
                app.logger.exception('Notification scheduler tick failed')
            finally:
                db.session.remove()
        time.sleep(TICK_SECONDS)


# ------------------------------------------------------------------- routes

def _settings_payload(settings):
    last = (EmailLog.query.filter_by(kind='daily_report').order_by(EmailLog.created_at.desc()).first())
    upcoming = next_closing(settings)
    return {
        'smtp': smtp_status(),
        'low_stock_alerts_enabled': settings.low_stock_alerts_enabled,
        'auto_pause_products': settings.auto_pause_products,
        'daily_report_enabled': settings.daily_report_enabled,
        'closing_time': settings.closing_time,
        'timezone': settings.timezone,
        'next_report_at': upcoming.isoformat(),
        'current_business_date': business_date(upcoming).isoformat(),
        'last_daily_report': last.to_dict() if last else None,
        'low_stock_count': sum(1 for i in Ingredient.query.all() if is_low_stock(i)),
        'paused_products': paused_product_names(settings),
    }


def _valid_timezone(name):
    global _TIMEZONES
    if _TIMEZONES is None:
        _TIMEZONES = available_timezones() | {'UTC'}
    return name in _TIMEZONES


def _cooling_down(kind):
    last = EmailLog.query.filter_by(kind=kind).order_by(EmailLog.created_at.desc()).first()
    if last and datetime.utcnow() - last.created_at < MANUAL_SEND_COOLDOWN:
        wait = int((MANUAL_SEND_COOLDOWN - (datetime.utcnow() - last.created_at)).total_seconds()) + 1
        return jsonify({'error': f'Please wait {wait}s before sending another one.'}), 429
    return None


@bp.route('/settings', methods=['GET', 'PUT'])
def notification_settings():
    settings = StoreSettings.current()
    if request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        for flag in ('low_stock_alerts_enabled', 'auto_pause_products', 'daily_report_enabled'):
            if flag in data:
                setattr(settings, flag, bool(data[flag]))

        schedule_changed = False
        if 'closing_time' in data:
            value = str(data['closing_time']).strip()
            if not CLOSING_RE.match(value):
                return jsonify({'error': 'Closing time must look like 22:00'}), 400
            schedule_changed |= value != settings.closing_time
            settings.closing_time = value
        if 'timezone' in data:
            value = str(data['timezone']).strip()
            if not _valid_timezone(value):
                return jsonify({'error': f'Unknown time zone: {value}'}), 400
            schedule_changed |= value != settings.timezone
            settings.timezone = value
        if schedule_changed:
            # Only closings after this change trigger a report; never one that already passed.
            settings.last_report_key = report_key(latest_closing(settings))
        db.session.commit()
    return jsonify(_settings_payload(settings))


@bp.route('/recipients', methods=['GET', 'POST'])
def manage_recipients():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        email = str(data.get('email') or '').strip().lower()
        if not is_valid_email(email):
            return jsonify({'error': 'Enter a valid email address'}), 400
        if NotificationRecipient.query.filter_by(email=email).first():
            return jsonify({'error': f'{email} is already a recipient'}), 409
        if NotificationRecipient.query.count() >= MAX_RECIPIENTS:
            return jsonify({'error': f'You can add up to {MAX_RECIPIENTS} recipients'}), 400
        recipient = NotificationRecipient(
            email=email,
            name=(str(data.get('name') or '').strip()[:100] or None),
            receives_low_stock=bool(data.get('receives_low_stock', True)),
            receives_daily_report=bool(data.get('receives_daily_report', True)),
        )
        db.session.add(recipient)
        db.session.commit()
        return jsonify(recipient.to_dict()), 201

    rows = NotificationRecipient.query.order_by(NotificationRecipient.created_at).all()
    return jsonify([r.to_dict() for r in rows])


@bp.route('/recipients/<int:id>', methods=['PUT', 'DELETE'])
def update_recipient(id):
    recipient = NotificationRecipient.query.get_or_404(id)
    if request.method == 'DELETE':
        db.session.delete(recipient)
        db.session.commit()
        return jsonify({'message': 'Recipient removed'})

    data = request.get_json(silent=True) or {}
    if 'email' in data:
        email = str(data['email'] or '').strip().lower()
        if not is_valid_email(email):
            return jsonify({'error': 'Enter a valid email address'}), 400
        clash = NotificationRecipient.query.filter_by(email=email).first()
        if clash and clash.id != recipient.id:
            return jsonify({'error': f'{email} is already a recipient'}), 409
        recipient.email = email
    if 'name' in data:
        recipient.name = str(data['name'] or '').strip()[:100] or None
    for flag in ('receives_low_stock', 'receives_daily_report', 'is_active'):
        if flag in data:
            setattr(recipient, flag, bool(data[flag]))
    db.session.commit()
    return jsonify(recipient.to_dict())


@bp.route('/log', methods=['GET'])
def email_log():
    limit = min(max(request.args.get('limit', default=20, type=int), 1), 100)
    rows = EmailLog.query.order_by(EmailLog.created_at.desc()).limit(limit).all()
    return jsonify([r.to_dict() for r in rows])


@bp.route('/test', methods=['POST'])
def send_test():
    blocked = _cooling_down('test')
    if blocked:
        return blocked
    data = request.get_json(silent=True) or {}
    if data.get('email'):
        email = str(data['email']).strip().lower()
        if not is_valid_email(email):
            return jsonify({'error': 'Enter a valid email address'}), 400
        to = [email]
    else:
        to = recipients_for('test')
    subject, html, text = test_email(smtp_status()['sender'])
    log = queue_email('test', subject, html, text, to)
    return jsonify(log.to_dict()), 202


@bp.route('/low-stock/send', methods=['POST'])
def send_low_stock_now():
    blocked = _cooling_down('low_stock')
    if blocked:
        return blocked
    low = sorted((i for i in Ingredient.query.all() if is_low_stock(i)), key=lambda i: float(i.stock_level))
    if not low:
        return jsonify({'error': 'Every ingredient is above its reorder point; nothing to report.'}), 400
    log = send_low_stock([], low, StoreSettings.current())
    return jsonify(log.to_dict()), 202


def _report_closing(settings):
    raw = request.args.get('date')
    if not raw and request.method == 'POST':
        raw = (request.get_json(silent=True) or {}).get('date')
    if raw:
        try:
            return closing_for_date(settings, date.fromisoformat(raw)), None
        except ValueError:
            return None, (jsonify({'error': 'Date must look like 2026-10-04'}), 400)
    # Default: the business day in progress, so far.
    return next_closing(settings), None


@bp.route('/daily-report/preview', methods=['GET'])
def preview_daily_report():
    settings = StoreSettings.current()
    close_local, err = _report_closing(settings)
    if err:
        return err
    report = build_report(settings, close_local)
    subject, html, _ = render_report(report)
    return jsonify({'subject': subject, 'html': html, 'summary': report_summary(report)})


@bp.route('/daily-report/send', methods=['POST'])
def send_daily_report_now():
    blocked = _cooling_down('daily_report')
    if blocked:
        return blocked
    settings = StoreSettings.current()
    close_local, err = _report_closing(settings)
    if err:
        return err
    log = send_daily_report(settings, close_local)
    return jsonify(log.to_dict()), 202
