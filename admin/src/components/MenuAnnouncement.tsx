import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Eye, Loader2, Megaphone, Send, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const NOTE_LIMIT = 300;

interface Audience {
  active: number;
  smtp_configured: boolean;
  daily_limit_hint: number;
}

export interface AnnouncementDraft {
  name: string;
  category: string;
  price: number;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  offered_sizes: string[];
  image_url: string | null;
  made_with: string[];
}

interface MenuAnnouncementProps {
  /** create: ticks a box and the email goes out on save. edit: sends right away for an existing item. */
  mode: 'create' | 'edit';
  itemId?: number;
  isAvailable: boolean;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  note: string;
  onNoteChange: (next: string) => void;
  buildDraft: () => AnnouncementDraft;
}

export const MenuAnnouncement: React.FC<MenuAnnouncementProps> = ({
  mode,
  itemId,
  isAvailable,
  enabled,
  onEnabledChange,
  note,
  onNoteChange,
  buildDraft
}) => {
  const [audience, setAudience] = useState<Audience | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/subscribers/audience`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => !cancelled && setAudience(data))
      .catch(() => !cancelled && setAudience(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const blocker = !audience
    ? 'Checking your subscriber list…'
    : !audience.smtp_configured
      ? 'Connect a Gmail sender under Email Notifications to announce new items.'
      : audience.active === 0
        ? 'No subscribers yet. Guests can sign up right after they order.'
        : !isAvailable
          ? 'Mark the item as available for sale to announce it.'
          : null;

  // An item switched off after the box was ticked should not be announced.
  useEffect(() => {
    if (blocker && enabled) onEnabledChange(false);
  }, [blocker, enabled, onEnabledChange]);

  const openPreview = async () => {
    setPreviewing(true);
    try {
      const res = await fetch(`${API_URL}/subscribers/announce/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildDraft(), note })
      });
      if (res.ok) setPreview(await res.json());
    } finally {
      setPreviewing(false);
    }
  };

  const sendNow = async () => {
    if (!itemId || !audience) return;
    if (!confirm(`Email ${audience.active} subscriber(s) about this item now?`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/menu/${itemId}/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Could not send the announcement');
      setResult(
        body.status === 'skipped'
          ? { ok: false, text: body.error || 'Not sent' }
          : { ok: true, text: `Sending to ${body.recipient_count} subscriber(s). Check Email Notifications for delivery.` }
      );
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setSending(false);
    }
  };

  const active = audience?.active ?? 0;
  const overLimit = audience && active > audience.daily_limit_hint * 0.8;
  const showDetails = mode === 'edit' ? !blocker : enabled;

  return (
    <div style={{ ...styles.box, ...(showDetails ? styles.boxOn : null) }}>
      <div style={styles.head}>
        <div style={styles.icon}>
          <Megaphone size={18} color="var(--accent-gold)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.title}>
            {mode === 'create' ? 'Announce it to subscribers' : 'Email subscribers about this item'}
          </div>
          <div style={styles.sub}>
            {blocker ??
              `${active} customer${active === 1 ? '' : 's'} asked to hear about new menu items.`}
          </div>
        </div>
        {mode === 'create' && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Email this new item to subscribers"
            disabled={Boolean(blocker)}
            className={`notif-switch${enabled ? ' is-on' : ''}`}
            onClick={() => onEnabledChange(!enabled)}
          >
            <span className="notif-switch__knob" />
          </button>
        )}
      </div>

      {showDetails && (
        <div style={styles.details}>
          <label style={styles.noteLabel} htmlFor="announce-note">
            Add a short note <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
          </label>
          <textarea
            id="announce-note"
            className="glass-input"
            rows={2}
            maxLength={NOTE_LIMIT}
            placeholder="e.g. Available all October, while ube season lasts."
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          />
          <div style={styles.footRow}>
            <span style={styles.hint}>
              {note.length}/{NOTE_LIMIT}
              {overLimit && ' · Gmail sends about 500 emails a day; a larger list may be cut off.'}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" style={styles.smallBtn} onClick={openPreview} disabled={previewing}>
                {previewing ? <Loader2 size={14} className="notif-spin" /> : <Eye size={14} />}
                Preview email
              </button>
              {mode === 'edit' && (
                <button type="button" className="btn btn-primary" style={styles.smallBtn} onClick={sendNow} disabled={sending}>
                  {sending ? <Loader2 size={14} className="notif-spin" /> : <Send size={14} />}
                  Send to {active}
                </button>
              )}
            </div>
          </div>
          {mode === 'create' && (
            <div style={styles.hint}>
              <CheckCircle2 size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} color="#10b981" />
              Goes out to {active} subscriber{active === 1 ? '' : 's'} when you click <b>Add to Menu</b>. Each email has a
              one-click unsubscribe link.
            </div>
          )}
          {result && (
            <div style={{ ...styles.hint, color: result.ok ? '#10b981' : '#ef4444' }} role="status">
              {result.text}
            </div>
          )}
        </div>
      )}

      {preview &&
        createPortal(
          <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}>
            <div className="modal-content" role="dialog" aria-label="Announcement preview">
              <div style={styles.previewHead}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Email preview</h3>
                  <span style={styles.sub}>Subject: {preview.subject}</span>
                </div>
                <button type="button" className="modal-close-btn" onClick={() => setPreview(null)} aria-label="Close preview">
                  <X size={20} />
                </button>
              </div>
              <iframe title="Announcement preview" srcDoc={preview.html} sandbox="" style={styles.iframe} />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  box: { border: '1px solid var(--border-glass)', borderRadius: 12, padding: 14, background: 'var(--surface-muted)', display: 'flex', flexDirection: 'column', gap: 12 },
  boxOn: { borderColor: 'rgba(245, 158, 11, 0.45)', background: 'rgba(245, 158, 11, 0.06)' },
  head: { display: 'flex', alignItems: 'center', gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 10, background: 'var(--accent-gold-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' },
  sub: { fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  details: { display: 'flex', flexDirection: 'column', gap: 8 },
  noteLabel: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  footRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  hint: { fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  smallBtn: { padding: '6px 12px', fontSize: '0.82rem' },
  previewHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border-glass)' },
  iframe: { flex: 1, width: '100%', minHeight: '60vh', border: 'none', background: '#f6efe6' }
};
