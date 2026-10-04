"""End-of-day sales report: numbers, profit, insights and a conclusion, rendered for email.

A business day is the 24 hours that end at the store's closing time, so a billiards night that
closes at 02:00 is still reported as one day. Profit here is gross profit: sales minus the
ingredient cost of what was sold (recipe quantities x each ingredient's current cost per unit).
Labour, rent and utilities are not in the system, so they are not in the number.
"""
import json
from datetime import datetime, timedelta, timezone
from html import escape
from zoneinfo import ZoneInfo

from models import (
    Ingredient, MenuItem, Order, Review, StockInLog, Transaction, LEVEL_MULTIPLIERS,
    is_low_stock, order_size_for, recipe_qty_for_size,
)
from email_templates import (
    ACCENT, BAD, BORDER, CREAM, GOOD, MUTED, WARN, admin_url, button, fmt_qty, layout, money, section, table,
)

HEALTHY_MARGIN = 65.0  # cafés usually aim for ingredient cost under ~35% of sales
THIN_MARGIN = 55.0


# ------------------------------------------------------------------ calendar

def store_tz(settings):
    try:
        return ZoneInfo(settings.timezone or 'UTC')
    except Exception:
        return ZoneInfo('UTC')


def _closing_hm(settings):
    try:
        hour, minute = (int(p) for p in (settings.closing_time or '22:00').split(':', 1))
        return hour % 24, minute % 60
    except ValueError:
        return 22, 0


def latest_closing(settings, now_utc=None):
    """The most recent closing instant at or before now, as an aware store-local datetime."""
    tz = store_tz(settings)
    now_local = (now_utc or datetime.now(timezone.utc)).astimezone(tz)
    hour, minute = _closing_hm(settings)
    candidate = now_local.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate > now_local:
        candidate -= timedelta(days=1)
    return candidate


def next_closing(settings, now_utc=None):
    return latest_closing(settings, now_utc) + timedelta(days=1)


def business_date(close_local):
    # Noon-anchored: closing at 22:00 or at 02:00 the next morning both belong to the same day.
    return (close_local - timedelta(hours=12)).date()


def closing_for_date(settings, day):
    tz = store_tz(settings)
    hour, minute = _closing_hm(settings)
    candidate = datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz)
    if business_date(candidate) != day:
        candidate += timedelta(days=1)
    return candidate


def report_key(close_local) -> str:
    return close_local.strftime('%Y-%m-%dT%H:%M')


def _naive_utc(aware):
    return aware.astimezone(timezone.utc).replace(tzinfo=None)


# ------------------------------------------------------------------- metrics

def _levels(order_item):
    try:
        parsed = json.loads(order_item.customizations) if order_item.customizations else []
        return {c['ingredient_id']: c.get('level', 'Regular') for c in parsed if 'ingredient_id' in c}
    except (TypeError, ValueError):
        return {}


def window_metrics(start_utc, end_utc, tz):
    orders = Order.query.filter(Order.created_at >= start_utc, Order.created_at < end_utc).all()
    valid = [o for o in orders if o.status != 'cancelled']
    order_ids = [o.id for o in valid]

    m = {
        'revenue': 0.0, 'cogs': 0.0, 'orders': len(valid), 'cancelled': len(orders) - len(valid),
        'items_sold': 0, 'products': {}, 'categories': {}, 'hours': {}, 'channels': {}, 'dining': {},
        'payments': {}, 'usage': {},
    }
    for order in valid:
        m['revenue'] += float(order.total_amount or 0)
        channel = 'Table QR' if order.channel == 'qr' else 'Counter'
        m['channels'][channel] = m['channels'].get(channel, 0) + 1
        if order.dining:
            label = 'Dine-in' if order.dining == 'dine_in' else 'Takeaway'
            m['dining'][label] = m['dining'].get(label, 0) + 1
        hour = order.created_at.replace(tzinfo=timezone.utc).astimezone(tz).hour
        bucket = m['hours'].setdefault(hour, {'orders': 0, 'revenue': 0.0})
        bucket['orders'] += 1
        bucket['revenue'] += float(order.total_amount or 0)

        for oi in order.items:
            item = oi.menu_item
            name = item.name if item else f'Item #{oi.menu_item_id}'
            sales = float(oi.price_at_order) * oi.quantity
            cost = 0.0
            if item:
                size = order_size_for(item, oi.size)
                levels = _levels(oi)
                for recipe in item.ingredients:
                    ing = recipe.ingredient
                    if not ing:
                        continue
                    level = levels.get(recipe.ingredient_id, 'Regular') if recipe.is_customizable else 'Regular'
                    qty = oi.quantity * recipe_qty_for_size(recipe, size) * LEVEL_MULTIPLIERS.get(level, 1.0)
                    cost += qty * float(ing.cost_per_unit or 0)
                    m['usage'][ing.id] = m['usage'].get(ing.id, 0.0) + qty
            m['cogs'] += cost
            m['items_sold'] += oi.quantity
            p = m['products'].setdefault(name, {'qty': 0, 'sales': 0.0, 'cost': 0.0})
            p['qty'] += oi.quantity
            p['sales'] += sales
            p['cost'] += cost
            category = item.category if item else 'Other'
            m['categories'][category] = m['categories'].get(category, 0.0) + sales

    if order_ids:
        for txn in Transaction.query.filter(Transaction.order_id.in_(order_ids)).all():
            method = (txn.payment_method or 'other').title()
            m['payments'][method] = m['payments'].get(method, 0.0) + float(txn.total_amount or 0)

    m['profit'] = m['revenue'] - m['cogs']
    m['margin'] = (m['profit'] / m['revenue'] * 100) if m['revenue'] else 0.0
    m['avg_ticket'] = (m['revenue'] / m['orders']) if m['orders'] else 0.0
    return m


def _pct_change(now, before):
    if not before:
        return None
    return (now - before) / before * 100


# ------------------------------------------------------------------- insights

def _hour_label(hour):
    def fmt(h):
        suffix = 'AM' if h % 24 < 12 else 'PM'
        return f'{(h % 12) or 12} {suffix}'
    return f'{fmt(hour)}–{fmt(hour + 1)}'


def build_insights(today, prev, week_avg_revenue, low_stock, paused, idle_products):
    """Return (insights, conclusion). Each insight is (tone, text) with tone in good/warn/bad/info."""
    out = []
    if today['orders'] == 0:
        out.append(('warn', 'No sales were recorded in this business day.'))
        if low_stock:
            out.append(('bad', f'{len(low_stock)} ingredient(s) are at or below their reorder point.'))
        return out, 'No sales were recorded. Check that the store was open and that orders are being entered.'

    change = _pct_change(today['revenue'], prev['revenue'])
    if change is not None:
        tone = 'good' if change >= 5 else 'bad' if change <= -5 else 'info'
        direction = 'up' if change >= 0 else 'down'
        out.append((tone, f'Sales were {direction} {abs(change):.0f}% on the previous day '
                          f'({money(today["revenue"])} vs {money(prev["revenue"])}).'))

    vs_week = _pct_change(today['revenue'], week_avg_revenue)
    if vs_week is not None:
        tone = 'good' if vs_week >= 10 else 'bad' if vs_week <= -10 else 'info'
        word = 'above' if vs_week >= 0 else 'below'
        out.append((tone, f'That is {abs(vs_week):.0f}% {word} the 7-day average of {money(week_avg_revenue)}.'))

    if today['margin'] >= HEALTHY_MARGIN:
        out.append(('good', f'Gross margin was a healthy {today["margin"]:.0f}%: ingredients cost '
                            f'{100 - today["margin"]:.0f}% of sales.'))
    elif today['margin'] >= THIN_MARGIN:
        out.append(('warn', f'Gross margin was {today["margin"]:.0f}%, a little under the ~{HEALTHY_MARGIN:.0f}% '
                            f'cafés usually aim for.'))
    else:
        out.append(('bad', f'Gross margin was only {today["margin"]:.0f}%: ingredients ate '
                           f'{100 - today["margin"]:.0f}% of sales. Pricing or portioning needs a look.'))

    products = sorted(today['products'].items(), key=lambda kv: kv[1]['sales'], reverse=True)
    if products:
        name, p = products[0]
        share = p['sales'] / today['revenue'] * 100 if today['revenue'] else 0
        out.append(('info', f'{name} was the top seller: {p["qty"]} sold, {share:.0f}% of sales.'))

    thin = [(n, p) for n, p in products if p['sales'] > 0 and (p['sales'] - p['cost']) / p['sales'] * 100 < 45]
    if thin:
        name, p = min(thin, key=lambda kv: (kv[1]['sales'] - kv[1]['cost']) / kv[1]['sales'])
        margin = (p['sales'] - p['cost']) / p['sales'] * 100
        out.append(('warn', f'{name} earns the thinnest margin ({margin:.0f}%). Consider a price review '
                            f'or a smaller portion.'))

    if today['hours']:
        hour, h = max(today['hours'].items(), key=lambda kv: kv[1]['revenue'])
        out.append(('info', f'Busiest hour was {_hour_label(hour)} with {h["orders"]} order(s) '
                            f'and {money(h["revenue"])} in sales. Staff that window first.'))

    ticket_change = _pct_change(today['avg_ticket'], prev['avg_ticket'])
    if ticket_change is not None and abs(ticket_change) >= 10:
        tone = 'good' if ticket_change > 0 else 'warn'
        word = 'rose' if ticket_change > 0 else 'fell'
        out.append((tone, f'Average order {word} {abs(ticket_change):.0f}% to {money(today["avg_ticket"])}.'))

    total = today['orders'] + today['cancelled']
    if total and today['cancelled'] / total > 0.05:
        out.append(('bad', f'{today["cancelled"]} order(s) were cancelled '
                           f'({today["cancelled"] / total * 100:.0f}% of all orders).'))

    qr = today['channels'].get('Table QR', 0)
    if qr:
        out.append(('info', f'{qr / today["orders"] * 100:.0f}% of orders came through table QR codes.'))

    running_out = []
    for ing in low_stock:
        used = today['usage'].get(ing.id, 0.0)
        if used > 0:
            running_out.append(f'{ing.name} (~{float(ing.stock_level) / used:.1f} day(s) left at today\'s pace)')
        else:
            running_out.append(ing.name)
    if running_out:
        out.append(('bad', 'Restock needed: ' + ', '.join(running_out[:5]) +
                           (f' and {len(running_out) - 5} more' if len(running_out) > 5 else '') + '.'))
    if paused:
        out.append(('warn', f'{len(paused)} product(s) are paused on the menu for low stock, '
                            f'so customers cannot order them right now.'))
    if idle_products:
        shown = ', '.join(idle_products[:3])
        more = f' and {len(idle_products) - 3} more' if len(idle_products) > 3 else ''
        out.append(('info', f'No sales today for {shown}{more}. Consider featuring or retiring them.'))

    # Conclusion: verdict + margin + the single most useful thing to do tomorrow.
    if vs_week is None:
        verdict = 'A first day on the books'
    elif vs_week >= 10:
        verdict = 'A strong day'
    elif vs_week <= -10:
        verdict = 'A soft day'
    else:
        verdict = 'A steady day'
    conclusion = (f'{verdict}: {money(today["revenue"])} in sales from {today["orders"]} order(s), '
                  f'keeping {money(today["profit"])} after ingredient costs ({today["margin"]:.0f}% margin). ')
    if low_stock:
        names = ', '.join(i.name for i in low_stock[:3])
        conclusion += f'Priority for tomorrow: restock {names} before opening.'
    elif today['margin'] < THIN_MARGIN:
        conclusion += 'Priority for tomorrow: review prices on the lowest-margin items.'
    elif idle_products:
        conclusion += 'Priority for tomorrow: push the items that did not sell today.'
    else:
        conclusion += 'Inventory is healthy. Keep the same plan for tomorrow.'
    return out, conclusion


# --------------------------------------------------------------------- report

def build_report(settings, close_local):
    tz = store_tz(settings)
    start_local = close_local - timedelta(days=1)
    start, end = _naive_utc(start_local), _naive_utc(close_local)

    today = window_metrics(start, end, tz)
    prev = window_metrics(start - timedelta(days=1), start, tz)
    week_orders = Order.query.filter(
        Order.created_at >= start - timedelta(days=7), Order.created_at < start, Order.status != 'cancelled'
    ).all()
    week_avg_revenue = sum(float(o.total_amount or 0) for o in week_orders) / 7

    low_stock = sorted((i for i in Ingredient.query.all() if is_low_stock(i)), key=lambda i: float(i.stock_level))
    menu = MenuItem.query.filter_by(is_available=True).all()
    paused = sorted(i.name for i in menu if settings.auto_pause_products and i.low_stock_ingredients())
    idle = sorted(i.name for i in menu if i.name not in today['products'] and i.name not in paused)

    stock_ins = StockInLog.query.filter(StockInLog.received_at >= start, StockInLog.received_at < end).all()
    reviews = Review.query.filter(Review.created_at >= start, Review.created_at < end).all()

    insights, conclusion = build_insights(today, prev, week_avg_revenue, low_stock, paused, idle)
    return {
        'business_date': business_date(close_local).isoformat(),
        'window_start': start_local.isoformat(),
        'window_end': close_local.isoformat(),
        'timezone': str(tz),
        'today': today,
        'previous': prev,
        'week_avg_revenue': week_avg_revenue,
        'low_stock': low_stock,
        'paused': paused,
        'idle_products': idle,
        'stock_in_count': len(stock_ins),
        'stock_in_spend': sum(float(s.cost) for s in stock_ins),
        'reviews_count': len(reviews),
        'reviews_avg': (sum(r.rating for r in reviews) / len(reviews)) if reviews else None,
        'insights': insights,
        'conclusion': conclusion,
    }


def report_summary(report) -> dict:
    """JSON-safe headline numbers for the admin preview panel."""
    t = report['today']
    return {
        'business_date': report['business_date'],
        'window_start': report['window_start'],
        'window_end': report['window_end'],
        'revenue': round(t['revenue'], 2),
        'cogs': round(t['cogs'], 2),
        'profit': round(t['profit'], 2),
        'margin': round(t['margin'], 1),
        'orders': t['orders'],
        'items_sold': t['items_sold'],
        'insights': [{'tone': tone, 'text': text} for tone, text in report['insights']],
        'conclusion': report['conclusion'],
    }


# ---------------------------------------------------------------------- render

TONE_COLORS = {'good': GOOD, 'warn': WARN, 'bad': BAD, 'info': ACCENT}


def _delta(now, before):
    change = _pct_change(now, before)
    if change is None:
        return f'<span style="color:{MUTED};">no prior day</span>'
    color = GOOD if change >= 0 else BAD
    arrow = '▲' if change >= 0 else '▼'
    return f'<span style="color:{color};">{arrow} {abs(change):.0f}% vs prev. day</span>'


def _tile(label, value, sub):
    return (f'<td width="50%" style="padding:6px;"><div style="background:{CREAM};border-radius:10px;padding:14px;">'
            f'<div style="font-size:12px;color:{MUTED};font-weight:600;">{escape(label)}</div>'
            f'<div style="font-size:22px;font-weight:800;margin:4px 0;">{value}</div>'
            f'<div style="font-size:12px;">{sub}</div></div></td>')


def _bars(rows):
    """rows: [(label, value, display)] drawn as an email-safe bar chart."""
    peak = max((v for _, v, _ in rows), default=0) or 1
    out = ''
    for label, value, display in rows:
        width = max(2, round(value / peak * 100))
        out += (f'<tr><td style="padding:3px 8px 3px 0;font-size:12px;color:{MUTED};white-space:nowrap;">'
                f'{escape(label)}</td><td width="100%" style="padding:3px 0;">'
                f'<div style="background:{ACCENT};height:12px;border-radius:6px;width:{width}%;"></div></td>'
                f'<td style="padding:3px 0 3px 8px;font-size:12px;white-space:nowrap;">{escape(display)}</td></tr>')
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{out}</table>'


def render_report(report):
    t, p = report['today'], report['previous']
    day = datetime.fromisoformat(report['business_date'])
    day_label = day.strftime('%A, %B %d, %Y').replace(' 0', ' ')
    subject = f'Daily sales report, {day.strftime("%b %d").replace(" 0", " ")}: {money(t["revenue"])} sales, {money(t["profit"])} gross profit'

    tiles = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        + _tile('Gross sales', money(t['revenue']), _delta(t['revenue'], p['revenue']))
        + _tile('Gross profit', money(t['profit']), f'{t["margin"]:.0f}% margin · cost {money(t["cogs"])}')
        + '</tr><tr>'
        + _tile('Orders', f'{t["orders"]}', f'avg {money(t["avg_ticket"])} · {t["cancelled"]} cancelled')
        + _tile('Items sold', f'{t["items_sold"]}', _delta(t['items_sold'], p['items_sold']))
        + '</tr></table>'
    )

    body = (f'<p style="font-size:14px;color:{MUTED};margin:0 0 14px;">{escape(day_label)} · business day ending '
            f'{escape(datetime.fromisoformat(report["window_end"]).strftime("%I:%M %p").lstrip("0"))} '
            f'({escape(report["timezone"])})</p>')
    body += tiles

    body += (f'<div style="margin:20px 0 0;padding:14px 16px;border-left:4px solid {ACCENT};background:{CREAM};'
             f'border-radius:0 10px 10px 0;font-size:15px;line-height:1.6;"><b>Conclusion.</b> '
             f'{escape(report["conclusion"])}</div>')

    body += section('Insights')
    body += ''.join(
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>'
        f'<td valign="top" style="color:{TONE_COLORS[tone]};font-size:14px;padding-right:8px;">●</td>'
        f'<td style="font-size:14px;line-height:1.5;">{escape(text)}</td></tr></table>'
        for tone, text in report['insights']
    )

    products = sorted(t['products'].items(), key=lambda kv: kv[1]['sales'], reverse=True)
    if products:
        body += section('Top products')
        rows = []
        for name, prod in products[:8]:
            margin = (prod['sales'] - prod['cost']) / prod['sales'] * 100 if prod['sales'] else 0
            color = GOOD if margin >= HEALTHY_MARGIN else WARN if margin >= 45 else BAD
            rows.append([escape(name), str(prod['qty']), money(prod['sales']),
                         f'<span style="color:{color};font-weight:700;">{margin:.0f}%</span>'])
        body += table(['Product', 'Qty', 'Sales', 'Margin'], rows, ['left', 'right', 'right', 'right'])

    if t['categories']:
        body += section('Sales by category')
        cats = sorted(t['categories'].items(), key=lambda kv: kv[1], reverse=True)
        body += _bars([(c.title(), v, money(v)) for c, v in cats])

    if t['hours']:
        body += section('Sales by hour')
        first_hour = datetime.fromisoformat(report['window_start']).hour
        hours = sorted(t['hours'].items(), key=lambda kv: (kv[0] - first_hour) % 24)
        body += _bars([(_hour_label(h), v['revenue'], f'{money(v["revenue"])} · {v["orders"]}') for h, v in hours])

    mix_rows = []
    for method, amount in sorted(t['payments'].items(), key=lambda kv: kv[1], reverse=True):
        mix_rows.append(['Payment', escape(method), money(amount)])
    for channel, count in t['channels'].items():
        mix_rows.append(['Channel', escape(channel), f'{count} order(s)'])
    for dining, count in t['dining'].items():
        mix_rows.append(['Service', escape(dining), f'{count} order(s)'])
    if mix_rows:
        body += section('How customers ordered and paid')
        body += table(['', 'Type', 'Total'], mix_rows, ['left', 'left', 'right'])

    body += section('Inventory watch')
    if report['low_stock']:
        rows = [[escape(i.name), escape(fmt_qty(i.stock_level, i.unit)), escape(fmt_qty(i.reorder_point, i.unit))]
                for i in report['low_stock']]
        body += table(['Low ingredient', 'On hand', 'Reorder at'], rows, ['left', 'right', 'right'])
    else:
        body += f'<p style="font-size:14px;margin:0;color:{GOOD};">Every ingredient is above its reorder point.</p>'
    extras = [f'{report["stock_in_count"]} stock-in(s) recorded ({money(report["stock_in_spend"])} spent)']
    if report['reviews_count']:
        extras.append(f'{report["reviews_count"]} new review(s), average {report["reviews_avg"]:.1f}★')
    body += f'<p style="font-size:13px;color:{MUTED};margin:12px 0 0;">{escape(" · ".join(extras))}</p>'

    body += f'<div style="margin-top:24px;">{button("Open the admin dashboard", admin_url())}</div>'
    body += (f'<p style="font-size:12px;color:{MUTED};margin:16px 0 0;border-top:1px solid {BORDER};padding-top:12px;">'
             f'Gross profit is sales minus the ingredient cost of each recipe at current unit costs. '
             f'It does not include labour, rent or utilities.</p>')

    html = layout('End-of-day sales report', subject, body)

    lines = [
        f'Break & Brews: daily sales report for {day_label}', '',
        f'Gross sales:  {money(t["revenue"])}',
        f'Gross profit: {money(t["profit"])} ({t["margin"]:.0f}% margin, ingredient cost {money(t["cogs"])})',
        f'Orders:       {t["orders"]} (avg {money(t["avg_ticket"])}, {t["cancelled"]} cancelled)',
        f'Items sold:   {t["items_sold"]}', '',
        'Conclusion: ' + report['conclusion'], '', 'Insights:',
    ] + [f'- {text}' for _, text in report['insights']]
    if products:
        lines += ['', 'Top products:'] + [f'- {n}: {pr["qty"]} sold, {money(pr["sales"])}' for n, pr in products[:8]]
    lines += ['', f'Admin portal: {admin_url()}']
    return subject, html, '\n'.join(lines)
