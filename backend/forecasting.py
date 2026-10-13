"""Sales forecast and stock projection: the numbers behind the AI sales insights.

Everything here is plain arithmetic over the store's own orders, recipes and batches, so it works
without an API key and gives the same answer every time. insights.py hands this output to Claude,
which explains it and adds outside context (weather, news, events); Claude never invents a figure.

Days are business days in the store's time zone: when the store closes after midnight (a billiards
night ending at 02:00), orders before closing count toward the previous day, as in daily_report.py.

Forecast per menu item = a level (60% last 7 days + 40% last 28 days, daily average) times a
day-of-week factor learned from the whole store's history and shrunk toward 1 while data is thin.
Ingredient demand is that forecast run through each item's recipe, using the size and
customisation mix actually ordered.
"""
import json
import math
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import selectinload

from models import (
    Ingredient, MenuItem, Order, OrderItem, StoreSettings, LEVEL_MULTIPLIERS, is_low_stock, order_size_for,
    recipe_qty_for_size,
)
from batches import active_batches, fefo_order
from daily_report import _closing_hm, store_tz

HISTORY_DAYS = 56
HORIZON_DAYS = 7
SAFETY_DAYS = 3  # extra cover on top of the forecast when suggesting an order quantity
RECENT_WEIGHT = 0.6
TREND_MIN_UNITS = 3  # below this many units in a week, a % change is noise
TREND_THRESHOLD = 20.0  # percent
IDLE_DAYS = 14
MIN_BACKTEST_HISTORY = 21
MIN_BACKTEST_UNITS = 10  # an accuracy score over a handful of sales means nothing


# ------------------------------------------------------------------ calendar

def business_day(created_at_utc, tz, closing_hm):
    """The business date an order belongs to (naive-UTC timestamp in, store-local date out)."""
    local = created_at_utc.replace(tzinfo=timezone.utc).astimezone(tz)
    hour, minute = closing_hm
    if hour < 12 and (local.hour, local.minute) < (hour, minute):
        return local.date() - timedelta(days=1)
    return local.date()


def current_business_day(settings, now_utc=None):
    now = (now_utc or datetime.utcnow())
    return business_day(now, store_tz(settings), _closing_hm(settings))


def _levels(order_item):
    try:
        parsed = json.loads(order_item.customizations) if order_item.customizations else []
        return {c['ingredient_id']: c.get('level', 'Regular') for c in parsed if 'ingredient_id' in c}
    except (TypeError, ValueError, KeyError):
        return {}


def _usage_for(item, order_item):
    """{ingredient_id: qty} one order line consumes under the item's current recipe."""
    size = order_size_for(item, order_item.size)
    levels = _levels(order_item)
    usage = {}
    for recipe in item.ingredients:
        level = levels.get(recipe.ingredient_id, 'Regular') if recipe.is_customizable else 'Regular'
        qty = order_item.quantity * recipe_qty_for_size(recipe, size) * LEVEL_MULTIPLIERS.get(level, 1.0)
        usage[recipe.ingredient_id] = usage.get(recipe.ingredient_id, 0.0) + qty
    return usage


def _mean(values):
    return sum(values) / len(values) if values else 0.0


def _pct(now, before):
    if not before:
        return None
    return round((now - before) / before * 100, 1)


# ------------------------------------------------------------------- history

def load_history(settings, today, days=HISTORY_DAYS):
    """Daily sales per item and per store for the `days` business days before `today` (exclusive)."""
    tz = store_tz(settings)
    closing = _closing_hm(settings)
    start = today - timedelta(days=days)
    # Pad the UTC window by a day each side; business_day() decides what is really in range.
    window_start = datetime.combine(start - timedelta(days=1), datetime.min.time())
    orders = (
        Order.query.options(selectinload(Order.items).selectinload(OrderItem.menu_item))
        .filter(Order.created_at >= window_start, Order.status != 'cancelled')
        .all()
    )

    item_units = defaultdict(lambda: defaultdict(float))  # item_id -> day -> units
    item_sales = defaultdict(lambda: defaultdict(float))  # item_id -> day -> revenue
    store = defaultdict(lambda: {'revenue': 0.0, 'orders': 0, 'units': 0.0})
    hours = defaultdict(lambda: {'orders': 0, 'revenue': 0.0})
    usage_total = defaultdict(lambda: defaultdict(float))  # item_id -> ingredient_id -> qty
    units_total = defaultdict(float)  # item_id -> units (for per-unit usage)
    first_day = None

    for order in orders:
        day = business_day(order.created_at, tz, closing)
        if day < start or day >= today:
            continue
        first_day = day if first_day is None else min(first_day, day)
        revenue = float(order.total_amount or 0)
        store[day]['revenue'] += revenue
        store[day]['orders'] += 1
        if day >= today - timedelta(days=28):
            hour = order.created_at.replace(tzinfo=timezone.utc).astimezone(tz).hour
            hours[hour]['orders'] += 1
            hours[hour]['revenue'] += revenue
        for oi in order.items:
            item = oi.menu_item
            if not item:
                continue
            item_units[item.id][day] += oi.quantity
            item_sales[item.id][day] += float(oi.price_at_order or 0) * oi.quantity
            store[day]['units'] += oi.quantity
            units_total[item.id] += oi.quantity
            for ing_id, qty in _usage_for(item, oi).items():
                usage_total[item.id][ing_id] += qty

    return {
        'start': start,
        'first_day': first_day,
        'item_units': item_units,
        'item_sales': item_sales,
        'store': store,
        'hours': hours,
        'usage_total': usage_total,
        'units_total': units_total,
    }


def _series(by_day, start, end):
    """Values for each day in [start, end), zero-filled."""
    out = []
    d = start
    while d < end:
        out.append(by_day.get(d, 0.0))
        d += timedelta(days=1)
    return out


def weekday_factors(store_units, start, end):
    """Multiplier per weekday (0=Mon) from store-wide units, shrunk toward 1 when there are few weeks."""
    by_wd = defaultdict(list)
    d = start
    while d < end:
        by_wd[d.weekday()].append(store_units.get(d, 0.0))
        d += timedelta(days=1)
    overall = _mean([v for vals in by_wd.values() for v in vals])
    factors = {}
    for wd in range(7):
        vals = by_wd.get(wd, [])
        if not overall or not vals:
            factors[wd] = 1.0
            continue
        raw = _mean(vals) / overall
        n = len(vals)
        factors[wd] = round(1 + (raw - 1) * n / (n + 2), 3)
    return factors


def _level(values):
    """Blend of last-7 and last-28 daily averages from a zero-filled series ending yesterday."""
    last7 = values[-7:]
    last28 = values[-28:]
    if not values:
        return 0.0
    return RECENT_WEIGHT * _mean(last7) + (1 - RECENT_WEIGHT) * _mean(last28)


def _forecast_days(level, factors, first_day, horizon):
    return [(first_day + timedelta(days=i), level * factors[(first_day + timedelta(days=i)).weekday()])
            for i in range(horizon)]


def backtest(store_units, history_start, today, days=7):
    """Forecast each of the last `days` days using only data before it; returns weighted accuracy %."""
    if (today - history_start).days < MIN_BACKTEST_HISTORY + days:
        return None
    errors = actual_total = 0.0
    rows = []
    for back in range(days, 0, -1):
        target = today - timedelta(days=back)
        series = _series(store_units, history_start, target)
        factors = weekday_factors(store_units, history_start, target)
        predicted = _level(series) * factors[target.weekday()]
        actual = store_units.get(target, 0.0)
        errors += abs(predicted - actual)
        actual_total += actual
        rows.append({'date': target.isoformat(), 'predicted': round(predicted, 1), 'actual': round(actual, 1)})
    if actual_total < MIN_BACKTEST_UNITS:
        return None
    return {'accuracy_pct': round(max(0.0, 100 - errors / actual_total * 100), 1), 'days': rows}


# ------------------------------------------------------------------ forecast

def build_forecast(settings=None, today=None, horizon=HORIZON_DAYS):
    settings = settings or StoreSettings.current()
    today = today or current_business_day(settings)
    hist = load_history(settings, today)
    start = hist['first_day'] or today
    history_days = (today - start).days
    store_units = {d: v['units'] for d, v in hist['store'].items()}
    factors = weekday_factors(store_units, start, today)
    weekday_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    items = MenuItem.query.options(selectinload(MenuItem.ingredients)).all()
    ingredients = {i.id: i for i in Ingredient.query.options(selectinload(Ingredient.batches)).all()}

    item_rows = []
    daily_item_forecast = {}  # item_id -> [(day, units)]
    for item in items:
        units_by_day = hist['item_units'].get(item.id, {})
        series = _series(units_by_day, start, today)
        last7 = sum(series[-7:])
        prior21 = sum(series[-28:-7])
        prior_weekly = prior21 / 3 if len(series) > 7 else 0.0
        level = _level(series)
        days = _forecast_days(level, factors, today, horizon)
        daily_item_forecast[item.id] = days
        sales_by_day = hist['item_sales'].get(item.id, {})
        last_sold = max((d for d, u in units_by_day.items() if u > 0), default=None)

        change = _pct(last7, prior_weekly) if len(series) > 7 else None
        if not units_by_day:
            trend = 'no_sales'
        elif last_sold and (today - last_sold).days > IDLE_DAYS:
            trend = 'idle'
        elif prior_weekly == 0 and last7 > 0:
            trend = 'new'
        elif change is not None and max(last7, prior_weekly) >= TREND_MIN_UNITS and change >= TREND_THRESHOLD:
            trend = 'rising'
        elif change is not None and max(last7, prior_weekly) >= TREND_MIN_UNITS and change <= -TREND_THRESHOLD:
            trend = 'falling'
        else:
            trend = 'steady'

        item_rows.append({
            'id': item.id,
            'name': item.name,
            'category': item.category,
            'price': float(item.price),
            'is_available': item.is_available,
            'stock_paused': bool(item.low_stock_ingredients()),
            'units_last_7': round(last7, 1),
            'units_prev_week_avg': round(prior_weekly, 1),
            'change_pct': change,
            'revenue_last_7': round(sum(_series(sales_by_day, today - timedelta(days=7), today)), 2),
            'revenue_last_28': round(sum(_series(sales_by_day, today - timedelta(days=28), today)), 2),
            'last_sold': last_sold.isoformat() if last_sold else None,
            'trend': trend,
            'forecast_units_next_7': round(sum(u for _, u in days), 1),
        })
    item_rows.sort(key=lambda r: (r['revenue_last_28'], r['units_last_7']), reverse=True)

    # Per-unit ingredient usage: what each item actually consumed per unit sold, falling back to the
    # Regular recipe for items with no sales yet.
    per_unit = {}
    for item in items:
        sold = hist['units_total'].get(item.id, 0)
        if sold:
            per_unit[item.id] = {i: q / sold for i, q in hist['usage_total'][item.id].items()}
        else:
            per_unit[item.id] = {r.ingredient_id: recipe_qty_for_size(r, 'Regular') for r in item.ingredients}

    demand = defaultdict(lambda: [0.0] * horizon)  # ingredient_id -> daily demand
    for item in items:
        for i, (_, units) in enumerate(daily_item_forecast[item.id]):
            for ing_id, q in per_unit[item.id].items():
                demand[ing_id][i] += units * q

    # Recent usage (last 28 days at the same per-unit rates), for context next to the projection.
    used_last_28 = defaultdict(float)
    for item in items:
        units28 = sum(_series(hist['item_units'].get(item.id, {}), today - timedelta(days=28), today))
        for ing_id, q in per_unit[item.id].items():
            used_last_28[ing_id] += units28 * q

    ingredient_rows = []
    expiry_risks = []
    for ing in ingredients.values():
        daily = demand.get(ing.id, [0.0] * horizon)
        avg_daily = _mean(daily)
        stock = float(ing.stock_level or 0)
        reorder = float(ing.reorder_point or 0)
        cover = round(stock / avg_daily, 1) if avg_daily > 1e-9 else None
        runs_out = below_reorder = None
        left = stock
        for i, need in enumerate(daily):
            left -= need
            day = today + timedelta(days=i)
            if below_reorder is None and left <= reorder:
                below_reorder = day
            if runs_out is None and left <= 0:
                runs_out = day
                break
        if runs_out is None and avg_daily > 1e-9 and stock / avg_daily < 60:
            runs_out = today + timedelta(days=math.floor(stock / avg_daily))
        target = avg_daily * (horizon + SAFETY_DAYS) + reorder
        suggest = max(0.0, target - stock) if avg_daily > 1e-9 or is_low_stock(ing) else 0.0
        if is_low_stock(ing) and suggest == 0:
            suggest = max(0.0, reorder * 2 - stock)

        ingredient_rows.append({
            'id': ing.id,
            'name': ing.name,
            'category': ing.category,
            'unit': ing.unit,
            'stock_level': round(stock, 3),
            'reorder_point': reorder,
            'cost_per_unit': float(ing.cost_per_unit or 0),
            'is_low_stock': is_low_stock(ing),
            'used_last_28': round(used_last_28.get(ing.id, 0.0), 3),
            'forecast_daily_use': round(avg_daily, 3),
            'forecast_use_next_7': round(sum(daily), 3),
            'days_of_cover': cover,
            'hits_reorder_point_on': below_reorder.isoformat() if below_reorder else None,
            'runs_out_on': runs_out.isoformat() if runs_out else None,
            'suggested_order_qty': round(suggest, 2),
            'suggested_order_cost': round(suggest * float(ing.cost_per_unit or 0), 2),
        })

        # Expiry: walk the batches in the order they will be used and see what the forecast leaves.
        used_before = 0.0
        for batch in fefo_order(active_batches(ing), today):
            qty = float(batch.quantity_remaining or 0)
            if batch.expiry_date is None:
                used_before += qty
                continue
            days_left = (batch.expiry_date - today).days
            if days_left < 0:
                expiry_risks.append(_expiry_row(ing, batch, qty, days_left, 'expired'))
                continue
            usable = max(0.0, avg_daily * (days_left + 1) - used_before)
            leftover = qty - min(qty, usable)
            used_before += qty
            if leftover > 1e-6:
                expiry_risks.append(_expiry_row(ing, batch, leftover, days_left, 'will_expire'))

    ingredient_rows.sort(key=lambda r: (r['days_of_cover'] is None, r['days_of_cover'] or 0))
    expiry_risks.sort(key=lambda r: (r['days_left'], -r['value']))

    # Store totals and category movement.
    daily_store = []
    for i in range(min(history_days, 28), 0, -1):
        d = today - timedelta(days=i)
        row = hist['store'].get(d, {'revenue': 0.0, 'orders': 0, 'units': 0.0})
        daily_store.append({'date': d.isoformat(), 'weekday': weekday_names[d.weekday()],
                            'revenue': round(row['revenue'], 2), 'orders': row['orders'], 'units': row['units']})

    avg_price = {}
    for item in items:
        units = sum(hist['item_units'].get(item.id, {}).values())
        sales = sum(hist['item_sales'].get(item.id, {}).values())
        avg_price[item.id] = sales / units if units else float(item.price)
    forecast_days = []
    for i in range(horizon):
        d = today + timedelta(days=i)
        units = sum(daily_item_forecast[it.id][i][1] for it in items)
        revenue = sum(daily_item_forecast[it.id][i][1] * avg_price[it.id] for it in items)
        forecast_days.append({'date': d.isoformat(), 'weekday': weekday_names[d.weekday()],
                              'units': round(units, 1), 'revenue': round(revenue, 2)})

    categories = defaultdict(lambda: {'last_7': 0.0, 'prev_7': 0.0})
    for item in items:
        sales = hist['item_sales'].get(item.id, {})
        categories[item.category]['last_7'] += sum(_series(sales, today - timedelta(days=7), today))
        categories[item.category]['prev_7'] += sum(_series(sales, today - timedelta(days=14), today - timedelta(days=7)))
    category_rows = sorted(
        ({'category': c, 'revenue_last_7': round(v['last_7'], 2), 'revenue_prev_7': round(v['prev_7'], 2),
          'change_pct': _pct(v['last_7'], v['prev_7'])} for c, v in categories.items()),
        key=lambda r: r['revenue_last_7'], reverse=True,
    )

    hours = [{'hour': h, 'orders': v['orders'], 'revenue': round(v['revenue'], 2)}
             for h, v in sorted(hist['hours'].items())]

    last7 = [hist['store'].get(today - timedelta(days=i), {}) for i in range(1, 8)]
    prev7 = [hist['store'].get(today - timedelta(days=i), {}) for i in range(8, 15)]
    rev7 = sum(r.get('revenue', 0.0) for r in last7)
    revp = sum(r.get('revenue', 0.0) for r in prev7)

    notes = []
    if history_days < 14:
        notes.append(f'Only {history_days} day(s) of sales history: forecasts are rough until there are a few weeks.')
    elif history_days < 28:
        notes.append(f'{history_days} days of sales history: day-of-week patterns are still settling.')

    return {
        'generated_at': datetime.utcnow().isoformat(),
        'business_date': today.isoformat(),
        'timezone': settings.timezone,
        'history_days': history_days,
        'horizon_days': horizon,
        'data_notes': notes,
        'totals': {
            'revenue_last_7': round(rev7, 2),
            'revenue_prev_7': round(revp, 2),
            'revenue_change_pct': _pct(rev7, revp),
            'orders_last_7': sum(r.get('orders', 0) for r in last7),
            'forecast_revenue_next_7': round(sum(d['revenue'] for d in forecast_days), 2),
            'forecast_units_next_7': round(sum(d['units'] for d in forecast_days), 1),
        },
        'weekday_factors': {weekday_names[k]: v for k, v in factors.items()},
        'daily_history': daily_store,
        'forecast': forecast_days,
        'backtest': backtest(store_units, start, today),
        'items': item_rows,
        'categories': category_rows,
        'hours': hours,
        'ingredients': ingredient_rows,
        'expiry_risks': expiry_risks,
        # Kept for weather correlation in signals.py; not sent to the portals.
        '_category_units_by_day': _category_units(items, hist, start, today),
    }


def _expiry_row(ing, batch, qty, days_left, kind):
    return {
        'ingredient_id': ing.id,
        'ingredient': ing.name,
        'unit': ing.unit,
        'batch_id': batch.id,
        'batch_code': batch.batch_code,
        'expiry_date': batch.expiry_date.isoformat(),
        'days_left': days_left,
        'quantity_at_risk': round(qty, 3),
        'value': round(qty * float(ing.cost_per_unit or 0), 2),
        'kind': kind,
    }


def _category_units(items, hist, start, today):
    out = defaultdict(dict)
    for item in items:
        for day, units in hist['item_units'].get(item.id, {}).items():
            if start <= day < today:
                out[item.category][day.isoformat()] = out[item.category].get(day.isoformat(), 0.0) + units
    return out


def public_forecast(forecast):
    """The forecast without internal helper keys, safe to return from the API."""
    return {k: v for k, v in forecast.items() if not k.startswith('_')}
