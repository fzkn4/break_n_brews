"""HTML + plain-text email bodies.

Email clients ignore <style> blocks and most modern CSS, so everything is inline styles on
table layouts, kept to a 600px column that also reads well on a phone.
"""
import os
from html import escape

ESPRESSO = '#2b1d16'
CREAM = '#f6efe6'
CARD = '#ffffff'
ACCENT = '#c8873a'
MUTED = '#7a6a5f'
BORDER = '#eadfd2'
GOOD = '#2f7d4f'
BAD = '#b4432f'
WARN = '#b7791f'


def money(value) -> str:
    return f'₱{float(value or 0):,.2f}'


def admin_url() -> str:
    return (os.getenv('ADMIN_PORTAL_URL') or 'http://localhost:5173').rstrip('/')


def layout(title: str, preheader: str, body: str, footer_note: str = '') -> str:
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title></head>
<body style="margin:0;padding:0;background:{CREAM};font-family:Segoe UI,Helvetica,Arial,sans-serif;color:{ESPRESSO};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">{escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{CREAM};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td style="background:{ESPRESSO};border-radius:14px 14px 0 0;padding:20px 24px;">
      <div style="color:{ACCENT};font-size:12px;font-weight:700;letter-spacing:2px;">BREAK &amp; BREWS</div>
      <div style="color:#fff;font-size:20px;font-weight:700;margin-top:4px;">{escape(title)}</div>
    </td></tr>
    <tr><td style="background:{CARD};padding:24px;border-radius:0 0 14px 14px;border:1px solid {BORDER};border-top:none;">
      {body}
    </td></tr>
    <tr><td style="padding:16px 8px;color:{MUTED};font-size:12px;text-align:center;line-height:1.5;">
      {footer_note or 'Sent automatically by the Break &amp; Brews management system.'}<br>
      Manage who receives these emails under <b>Email Notifications</b> in the admin portal.
    </td></tr>
  </table>
</td></tr></table></body></html>"""


def button(label: str, href: str) -> str:
    return (f'<a href="{escape(href)}" style="display:inline-block;background:{ACCENT};color:#fff;'
            f'text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:9px;">'
            f'{escape(label)}</a>')


def section(title: str) -> str:
    return (f'<div style="font-size:13px;font-weight:700;letter-spacing:1px;color:{MUTED};'
            f'text-transform:uppercase;margin:24px 0 10px;">{escape(title)}</div>')


def table(headers: list, rows: list, align: list = None) -> str:
    """rows hold pre-escaped HTML cells."""
    align = align or ['left'] * len(headers)
    head = ''.join(
        f'<th align="{a}" style="padding:8px 10px;font-size:12px;color:{MUTED};font-weight:600;'
        f'border-bottom:2px solid {BORDER};">{escape(h)}</th>'
        for h, a in zip(headers, align)
    )
    body = ''.join(
        '<tr>' + ''.join(
            f'<td align="{a}" style="padding:9px 10px;font-size:14px;border-bottom:1px solid {BORDER};">{c}</td>'
            for c, a in zip(row, align)
        ) + '</tr>'
        for row in rows
    )
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            f'style="border-collapse:collapse;">{head and "<tr>" + head + "</tr>"}{body}</table>')


def pill(label: str, color: str) -> str:
    return (f'<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;'
            f'font-weight:700;color:{color};border:1px solid {color};">{escape(label)}</span>')


def fmt_qty(value: float, unit: str) -> str:
    value = float(value or 0)
    text = f'{value:,.0f}' if value == int(value) else f'{value:,.2f}'.rstrip('0').rstrip('.')
    return f'{text} {unit}'


def suggested_order(ing) -> float:
    """Enough to get back to twice the reorder point."""
    return max(0.0, float(ing.reorder_point) * 2 - float(ing.stock_level))


# ----------------------------------------------------------------- low stock

def low_stock_email(newly_low: list, all_low: list, paused_products: list, auto_pause: bool):
    new_ids = {i.id for i in newly_low}
    out_count = sum(1 for i in all_low if float(i.stock_level) <= 0)

    names = [i.name for i in newly_low]
    shown = ', '.join(names[:2]) + (f' (+{len(names) - 2} more)' if len(names) > 2 else '')
    subject = f'Low stock: {shown}' if names else f'Low stock summary: {len(all_low)} ingredient(s)'

    rows = []
    for ing in sorted(all_low, key=lambda i: (i.id not in new_ids, float(i.stock_level))):
        if float(ing.stock_level) <= 0:
            status = pill('OUT', BAD)
        else:
            status = pill('LOW', WARN)
        if ing.id in new_ids:
            status += ' ' + pill('NEW', ACCENT)
        rows.append([
            f'<b>{escape(ing.name)}</b><div style="font-size:12px;color:{MUTED};">{escape(ing.category)}</div>',
            escape(fmt_qty(ing.stock_level, ing.unit)),
            escape(fmt_qty(ing.reorder_point, ing.unit)),
            escape(fmt_qty(suggested_order(ing), ing.unit)),
            status,
        ])

    lead = (f'{len(newly_low)} ingredient(s) just dropped to or below their reorder point.'
            if newly_low else f'{len(all_low)} ingredient(s) are at or below their reorder point.')
    if out_count:
        verb = 'is' if out_count == 1 else 'are'
        lead += f' <b style="color:{BAD};">{out_count} {verb} completely out.</b>'

    body = f'<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">{lead}</p>'
    body += table(['Ingredient', 'On hand', 'Reorder at', 'Suggested order', 'Status'], rows,
                  ['left', 'right', 'right', 'right', 'left'])

    if auto_pause and paused_products:
        items = ''.join(f'<li style="margin:3px 0;">{escape(name)}</li>' for name in sorted(paused_products))
        body += section('Paused on the menu')
        body += (f'<p style="font-size:14px;line-height:1.6;margin:0 0 6px;">These products now show '
                 f'<b>"Unavailable at the moment"</b> to customers and staff. They come back on their own '
                 f'as soon as the ingredients are restocked:</p>'
                 f'<ul style="font-size:14px;margin:0;padding-left:20px;">{items}</ul>')

    body += f'<div style="margin-top:24px;">{button("Record a stock-in", admin_url())}</div>'

    text_lines = [lead.replace('<b style="color:' + BAD + ';">', '').replace('</b>', ''), '']
    for ing in all_low:
        flag = ' [NEW]' if ing.id in new_ids else ''
        text_lines.append(f'- {ing.name}: {fmt_qty(ing.stock_level, ing.unit)} on hand '
                          f'(reorder at {fmt_qty(ing.reorder_point, ing.unit)}; '
                          f'suggest ordering {fmt_qty(suggested_order(ing), ing.unit)}){flag}')
    if auto_pause and paused_products:
        text_lines += ['', 'Paused on the menu until restocked: ' + ', '.join(sorted(paused_products))]
    text_lines += ['', f'Admin portal: {admin_url()}']

    html = layout('Low stock alert', subject, body)
    return subject, html, '\n'.join(text_lines)


# ---------------------------------------------------------------------- test

def test_email(sender_masked: str):
    subject = 'Test email: notifications are working'
    body = (f'<p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Your Break &amp; Brews system can '
            f'send email. Low-stock alerts and the end-of-day sales report will arrive at this address.</p>'
            f'<p style="font-size:13px;color:{MUTED};margin:0;">Sent from {escape(sender_masked or "")}.</p>')
    text = ('Your Break & Brews system can send email. Low-stock alerts and the end-of-day sales '
            'report will arrive at this address.')
    return subject, layout('Email notifications are set up', subject, body), text
