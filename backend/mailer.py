"""Gmail SMTP delivery.

The sender address and App Password come only from the environment (backend/.env, which is
gitignored). They are never stored in the database, never returned by the API and never written
to a log; the admin portal only ever sees whether SMTP is configured and a masked sender.
"""
import os
import re
import smtplib
import ssl
import threading
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from flask import current_app

from models import db, EmailLog, NotificationRecipient

EMAIL_RE = re.compile(r'^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$')
SMTP_TIMEOUT_SECONDS = 20


def _smtp_config():
    user = (os.getenv('SMTP_USER') or '').strip()
    # Google shows App Passwords as "abcd efgh ijkl mnop"; the spaces are not part of it.
    password = re.sub(r'\s+', '', os.getenv('SMTP_APP_PASSWORD') or '')
    return {
        'user': user,
        'password': password,
        'host': (os.getenv('SMTP_HOST') or 'smtp.gmail.com').strip(),
        'port': int(os.getenv('SMTP_PORT') or 465),
        'from_name': (os.getenv('SMTP_FROM_NAME') or 'Break & Brews').strip(),
    }


def is_valid_email(value: str) -> bool:
    return bool(value) and len(value) <= 254 and bool(EMAIL_RE.match(value))


def mask_email(value: str) -> str:
    if '@' not in value:
        return ''
    local, domain = value.split('@', 1)
    return f'{local[:2]}{"•" * max(3, len(local) - 2)}@{domain}'


def smtp_status() -> dict:
    cfg = _smtp_config()
    configured = is_valid_email(cfg['user']) and bool(cfg['password'])
    return {
        'configured': configured,
        'sender': mask_email(cfg['user']) if configured else None,
        'host': f"{cfg['host']}:{cfg['port']}",
    }


def recipients_for(kind: str) -> list:
    query = NotificationRecipient.query.filter_by(is_active=True)
    if kind == 'low_stock':
        query = query.filter_by(receives_low_stock=True)
    elif kind == 'daily_report':
        query = query.filter_by(receives_daily_report=True)
    return [r.email for r in query.order_by(NotificationRecipient.id).all()]


def queue_email(kind: str, subject: str, html: str, text: str, to: list, personalize=None) -> EmailLog:
    """Record the email and deliver it on a background thread so no request waits on Gmail.

    personalize, when given, maps a recipient address to (html, text, extra_headers) so each person
    can get their own unsubscribe link. It is resolved here, before the thread starts.
    """
    log = EmailLog(kind=kind, subject=subject[:200], recipients=','.join(to), status='queued')
    if not smtp_status()['configured']:
        log.status = 'skipped'
        log.error = 'SMTP is not configured. Set SMTP_USER and SMTP_APP_PASSWORD in backend/.env.'
    elif not to:
        log.status = 'skipped'
        log.error = 'No active recipients are subscribed to this email.'
    db.session.add(log)
    db.session.commit()

    if log.status == 'queued':
        messages = [
            (address, *(personalize(address) if personalize else (html, text, {})))
            for address in to
        ]
        app = current_app._get_current_object()
        threading.Thread(target=_deliver, args=(app, log.id, subject, messages), daemon=True).start()
    return log


def _deliver(app, log_id, subject, messages):
    cfg = _smtp_config()
    error = None
    refused = []
    try:
        context = ssl.create_default_context()
        if cfg['port'] == 465:
            server = smtplib.SMTP_SSL(cfg['host'], cfg['port'], context=context, timeout=SMTP_TIMEOUT_SECONDS)
        else:
            server = smtplib.SMTP(cfg['host'], cfg['port'], timeout=SMTP_TIMEOUT_SECONDS)
            server.starttls(context=context)
        with server:
            server.login(cfg['user'], cfg['password'])
            # One message per recipient so nobody sees the rest of the list.
            for address, html, text, headers in messages:
                msg = EmailMessage()
                msg['Subject'] = subject
                msg['From'] = formataddr((cfg['from_name'], cfg['user']))
                msg['To'] = address
                msg['Message-ID'] = make_msgid(domain=cfg['user'].split('@', 1)[1])
                for name, value in headers.items():
                    msg[name] = value
                msg.set_content(text)
                msg.add_alternative(html, subtype='html')
                try:
                    server.send_message(msg)
                except smtplib.SMTPRecipientsRefused:
                    refused.append(address)  # one bad address must not stop the rest of a bulk send
    except smtplib.SMTPAuthenticationError:
        error = ('Gmail rejected the login. Check SMTP_USER, and that SMTP_APP_PASSWORD is a 16-character '
                 'App Password (the account needs 2-Step Verification turned on).')
    except (OSError, smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError) as exc:
        error = _scrub(f'Could not reach {cfg["host"]}:{cfg["port"]} ({type(exc).__name__}). Check the '
                       f'server\'s internet connection and that outbound SMTP is not blocked.', cfg['password'])
    except smtplib.SMTPException as exc:
        error = _scrub(f'{type(exc).__name__}: {exc}', cfg['password'])

    delivered = not error and len(refused) < len(messages)
    if not error and refused:
        error = (f'{len(refused)} of {len(messages)} address(es) were refused: '
                 + ', '.join(refused[:5]) + ('…' if len(refused) > 5 else ''))

    with app.app_context():
        log = db.session.get(EmailLog, log_id)
        if log:
            log.status = 'sent' if delivered else 'failed'
            log.error = error
            log.sent_at = datetime.utcnow() if delivered else None
            db.session.commit()


def _scrub(message: str, secret: str) -> str:
    if secret:
        message = message.replace(secret, '••••')
    return message[:500]
