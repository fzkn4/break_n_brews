"""Guest email list for new-menu announcements.

Guests opt in from the footer or the prompt shown after they order. Each announcement carries a
personal one-click unsubscribe link (plus List-Unsubscribe headers, so Gmail shows its own
"Unsubscribe" button). Sending uses the same Gmail SMTP sender as the staff notifications.
"""
import os
from datetime import datetime, timedelta
from html import escape

from flask import Blueprint, Response, jsonify, request

from models import db, EmailLog, MenuItem, Subscriber
from mailer import is_valid_email, queue_email, smtp_status
from email_templates import ACCENT, BORDER, CREAM, ESPRESSO, MUTED, money, new_menu_email

bp = Blueprint('subscribers', __name__)

SOURCES = ('footer', 'post_order')
ANNOUNCE_COOLDOWN = timedelta(seconds=60)
# Gmail caps a personal account at roughly 500 recipients a day (Workspace: 2,000).
GMAIL_DAILY_HINT = 500


def _public_api_url():
    return (os.getenv('PUBLIC_API_URL') or request.host_url.rstrip('/') + '/api').rstrip('/')


def _customer_portal_url():
    return (os.getenv('CUSTOMER_PORTAL_URL') or 'http://localhost:5176').rstrip('/')


def _price_label(item) -> str:
    sizes = [p for p in (item.get('price_small'), item.get('price_medium'), item.get('price_large')) if p]
    if item.get('offered_sizes') and len(sizes) > 1:
        return f'{money(min(sizes))} – {money(max(sizes))}'
    return money(item.get('price') or 0)


def _email_item(data: dict, made_with: list) -> dict:
    image = (data.get('image_url') or '').strip()
    if image.startswith('/'):
        image = _public_api_url().rsplit('/api', 1)[0] + image
    names = [n for n in made_with if n][:4]
    return {
        'name': (data.get('name') or 'Our newest item').strip(),
        'category': (data.get('category') or '').strip().title(),
        'price_label': _price_label(data),
        'image_url': image,
        'made_with': (', '.join(names[:-1]) + ' and ' + names[-1]) if len(names) > 1 else (names[0] if names else ''),
    }


def _made_with(menu_item) -> list:
    return [r.ingredient.name for r in menu_item.ingredients
            if r.ingredient and r.ingredient.category != 'Packaging']


def announce_menu_item(menu_item, note=None):
    """Email every active subscriber about a menu item. Returns the EmailLog."""
    if not menu_item.is_available:
        raise ValueError('Turn the item on (Active) before announcing it.')
    note = (note or '').strip()[:300] or None
    subscribers = Subscriber.query.filter_by(is_active=True).order_by(Subscriber.id).all()
    tokens = {s.email: s.unsubscribe_token for s in subscribers}

    info = _email_item(menu_item.to_dict(auto_pause=False), _made_with(menu_item))
    menu_url = f'{_customer_portal_url()}/?item={menu_item.id}'
    api = _public_api_url()

    def personalize(address):
        unsubscribe = f'{api}/subscribers/unsubscribe?token={tokens[address]}'
        _, html, text = new_menu_email(info, note, menu_url, unsubscribe)
        return html, text, {
            'List-Unsubscribe': f'<{unsubscribe}>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }

    subject, html, text = new_menu_email(info, note, menu_url, f'{api}/subscribers/unsubscribe')
    return queue_email('new_menu', subject, html, text, list(tokens), personalize)


def announcement_summary(log):
    return {
        'status': log.status,
        'error': log.error,
        'recipient_count': len([r for r in (log.recipients or '').split(',') if r]),
    }


# ------------------------------------------------------------------- routes

@bp.route('/api/subscribers', methods=['GET', 'POST'])
def manage_subscribers():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        email = str(data.get('email') or '').strip().lower()
        if not is_valid_email(email):
            return jsonify({'error': 'That email address does not look right. Check it and try again.'}), 400
        name = str(data.get('name') or '').strip()[:100] or None
        source = data.get('source') if data.get('source') in SOURCES else 'footer'

        existing = Subscriber.query.filter_by(email=email).first()
        if existing:
            status = 'already' if existing.is_active else 'resubscribed'
            existing.is_active = True
            existing.unsubscribed_at = None
            existing.name = existing.name or name
            db.session.commit()
            return jsonify({**existing.to_dict(), 'status': status}), 200

        subscriber = Subscriber(email=email, name=name, source=source)
        db.session.add(subscriber)
        db.session.commit()
        return jsonify({**subscriber.to_dict(), 'status': 'subscribed'}), 201

    subscribers = Subscriber.query.order_by(Subscriber.created_at.desc()).all()
    return jsonify([s.to_dict() for s in subscribers])


@bp.route('/api/subscribers/<int:id>', methods=['DELETE'])
def delete_subscriber(id):
    subscriber = Subscriber.query.get_or_404(id)
    db.session.delete(subscriber)
    db.session.commit()
    return jsonify({'message': 'Subscriber removed'})


@bp.route('/api/subscribers/audience', methods=['GET'])
def audience():
    """What the admin's "email subscribers" checkbox needs to know before it is ticked."""
    return jsonify({
        'active': Subscriber.query.filter_by(is_active=True).count(),
        'smtp_configured': smtp_status()['configured'],
        'daily_limit_hint': GMAIL_DAILY_HINT,
    })


@bp.route('/api/subscribers/announce/preview', methods=['POST'])
def preview_announcement():
    data = request.get_json(silent=True) or {}
    made_with = [str(n) for n in (data.get('made_with') or []) if n]
    info = _email_item(data, made_with)
    subject, html, _ = new_menu_email(info, (data.get('note') or '').strip()[:300] or None,
                                      f'{_customer_portal_url()}/', '#')
    return jsonify({'subject': subject, 'html': html})


@bp.route('/api/menu/<int:id>/announce', methods=['POST'])
def announce_existing(id):
    item = MenuItem.query.get_or_404(id)
    last = EmailLog.query.filter_by(kind='new_menu').order_by(EmailLog.created_at.desc()).first()
    if last and datetime.utcnow() - last.created_at < ANNOUNCE_COOLDOWN:
        return jsonify({'error': 'An announcement just went out. Wait a minute before sending another.'}), 429
    try:
        log = announce_menu_item(item, (request.get_json(silent=True) or {}).get('note'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify(announcement_summary(log)), 202


@bp.route('/api/subscribers/unsubscribe', methods=['GET', 'POST'])
def unsubscribe():
    token = request.values.get('token', '')
    subscriber = Subscriber.query.filter_by(unsubscribe_token=token).first() if token else None

    # RFC 8058 one-click: mail clients POST "List-Unsubscribe=One-Click" with no UI.
    if request.method == 'POST' and request.form.get('List-Unsubscribe') == 'One-Click':
        if subscriber and subscriber.is_active:
            subscriber.is_active = False
            subscriber.unsubscribed_at = datetime.utcnow()
            db.session.commit()
        return Response('Unsubscribed', mimetype='text/plain')

    if not subscriber:
        return _page('This link has expired',
                     '<p>We could not find that subscription. It may already have been removed.</p>'), 404

    email = escape(subscriber.email)
    if request.method == 'POST':
        if request.form.get('action') == 'resubscribe':
            subscriber.is_active = True
            subscriber.unsubscribed_at = None
            db.session.commit()
            return _page('Welcome back',
                         f'<p><b>{email}</b> will hear about new menu items again.</p>')
        subscriber.is_active = False
        subscriber.unsubscribed_at = datetime.utcnow()
        db.session.commit()
        return _page('You are unsubscribed',
                     f'<p><b>{email}</b> will not get any more new-menu emails from Break &amp; Brews.</p>'
                     + _form(token, 'resubscribe', 'Changed your mind? Resubscribe', secondary=True))

    # GET only asks; link scanners in mail clients open links, and that must not unsubscribe anyone.
    if not subscriber.is_active:
        return _page('You are already unsubscribed',
                     f'<p><b>{email}</b> is not on the new-menu list.</p>'
                     + _form(token, 'resubscribe', 'Resubscribe', secondary=True))
    return _page('Unsubscribe from new-menu emails?',
                 f'<p>Stop emailing <b>{email}</b> when something new lands on the menu.</p>'
                 + _form(token, 'unsubscribe', 'Unsubscribe'))


def _form(token, action, label, secondary=False):
    style = (f'background:transparent;color:{ESPRESSO};border:1px solid {BORDER};' if secondary
             else f'background:{ACCENT};color:#fff;border:none;')
    return (f'<form method="post" style="margin-top:20px;">'
            f'<input type="hidden" name="token" value="{escape(token)}">'
            f'<input type="hidden" name="action" value="{action}">'
            f'<button type="submit" style="{style}font:inherit;font-weight:700;padding:12px 20px;'
            f'border-radius:10px;cursor:pointer;">{escape(label)}</button></form>')


def _page(title, body):
    html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} · Break &amp; Brews</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:{CREAM};
font-family:Segoe UI,Helvetica,Arial,sans-serif;color:{ESPRESSO};padding:16px;box-sizing:border-box;">
<main style="max-width:440px;width:100%;background:#fff;border:1px solid {BORDER};border-radius:16px;padding:28px;">
<div style="color:{ACCENT};font-size:12px;font-weight:700;letter-spacing:2px;">BREAK &amp; BREWS</div>
<h1 style="font-size:22px;margin:8px 0 12px;">{escape(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:{MUTED};">{body}</div>
</main></body></html>"""
    return Response(html, mimetype='text/html')
