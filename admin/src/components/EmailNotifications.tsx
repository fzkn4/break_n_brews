import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  PackageX,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
  XCircle
} from 'lucide-react';
import type { DailyReportPreview, EmailLogEntry, NotificationRecipient, NotificationSettings } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const NOTIFY_URL = `${API_URL}/notifications`;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

interface EmailNotificationsProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

type SettingsPatch = Partial<
  Pick<NotificationSettings, 'low_stock_alerts_enabled' | 'auto_pause_products' | 'daily_report_enabled' | 'closing_time' | 'timezone'>
>;

const KIND_LABEL: Record<EmailLogEntry['kind'], string> = {
  low_stock: 'Low stock',
  daily_report: 'Daily report',
  test: 'Test',
  new_menu: 'New menu'
};

function timeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = ['UTC', 'Asia/Manila'];
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

function formatInZone(iso: string, zone: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat([], { ...opts, timeZone: zone }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function untilLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  if (minutes < 1) return 'any moment now';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `in ${h}h ${m}m` : `in ${m}m`;
}

// Backend timestamps are naive UTC.
function ago(isoUtc: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(isoUtc + 'Z').getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(isoUtc + 'Z').toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const money = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

const Switch: React.FC<{ checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }> = ({
  checked,
  onChange,
  label,
  disabled
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className={`notif-switch${checked ? ' is-on' : ''}`}
    onClick={() => onChange(!checked)}
  >
    <span className="notif-switch__knob" />
  </button>
);

const StatusBadge: React.FC<{ status: EmailLogEntry['status'] }> = ({ status }) => {
  const map = {
    sent: { color: '#10b981', icon: <CheckCircle2 size={13} />, label: 'Sent' },
    failed: { color: '#ef4444', icon: <XCircle size={13} />, label: 'Failed' },
    skipped: { color: '#f59e0b', icon: <AlertTriangle size={13} />, label: 'Not sent' },
    queued: { color: '#3b82f6', icon: <Loader2 size={13} className="notif-spin" />, label: 'Sending' }
  }[status];
  return (
    <span style={{ ...styles.statusBadge, color: map.color, borderColor: map.color }}>
      {map.icon}
      {map.label}
    </span>
  );
};

export const EmailNotifications: React.FC<EmailNotificationsProps> = ({ showToast }) => {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newLowStock, setNewLowStock] = useState(true);
  const [newDaily, setNewDaily] = useState(true);
  const [emailTouched, setEmailTouched] = useState(false);

  const [preview, setPreview] = useState<DailyReportPreview | null>(null);
  const [previewDate, setPreviewDate] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [sRes, rRes, lRes] = await Promise.all([
        fetch(`${NOTIFY_URL}/settings`),
        fetch(`${NOTIFY_URL}/recipients`),
        fetch(`${NOTIFY_URL}/log?limit=15`)
      ]);
      if (sRes.ok) setSettings(await sRes.json());
      if (rRes.ok) setRecipients(await rRes.json());
      if (lRes.ok) setLogs(await lRes.json());
      setLoadError(!sRes.ok);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll faster while something is still sending so the status flips without a manual refresh.
  const sending = logs.some((l) => l.status === 'queued');
  useEffect(() => {
    const timer = setInterval(refresh, sending ? 2000 : 10000);
    return () => clearInterval(timer);
  }, [refresh, sending]);

  const zones = useMemo(() => timeZones(settings?.timezone || 'UTC'), [settings?.timezone]);

  const saveSettings = async (patch: SettingsPatch, success?: string) => {
    if (!settings) return;
    const before = settings;
    setSettings({ ...settings, ...patch }); // optimistic
    try {
      const res = await fetch(`${NOTIFY_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not save settings'));
      setSettings(await res.json());
      if (success) showToast(success);
    } catch (err) {
      setSettings(before);
      showToast(err instanceof Error ? err.message : 'Could not save settings', 'error');
    }
  };

  const runAction = async (key: string, url: string, body: object, success: string) => {
    setBusy(key);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Something went wrong'));
      const log: EmailLogEntry = await res.json();
      if (log.status === 'skipped') showToast(log.error || 'Email was not sent', 'error');
      else showToast(success);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Network error', 'error');
    } finally {
      setBusy(null);
    }
  };

  // ---------------- recipients ----------------
  const emailValue = newEmail.trim().toLowerCase();
  const emailError = !emailValue
    ? 'Email is required'
    : !EMAIL_RE.test(emailValue)
      ? 'That does not look like an email address'
      : recipients.some((r) => r.email === emailValue)
        ? 'Already on the list'
        : !newLowStock && !newDaily
          ? 'Pick at least one email type'
          : '';

  const addRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (emailError) return;
    setBusy('add');
    try {
      const res = await fetch(`${NOTIFY_URL}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailValue,
          name: newName.trim() || null,
          receives_low_stock: newLowStock,
          receives_daily_report: newDaily
        })
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not add recipient'));
      const created: NotificationRecipient = await res.json();
      setRecipients((list) => [...list, created]);
      setNewEmail('');
      setNewName('');
      setEmailTouched(false);
      showToast(`${created.email} will now receive notifications`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add recipient', 'error');
    } finally {
      setBusy(null);
    }
  };

  const updateRecipient = async (r: NotificationRecipient, patch: Partial<NotificationRecipient>) => {
    setRecipients((list) => list.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    try {
      const res = await fetch(`${NOTIFY_URL}/recipients/${r.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not update recipient'));
    } catch (err) {
      setRecipients((list) => list.map((x) => (x.id === r.id ? r : x)));
      showToast(err instanceof Error ? err.message : 'Could not update recipient', 'error');
    }
  };

  const removeRecipient = async (r: NotificationRecipient) => {
    if (!confirm(`Stop emailing ${r.email}?`)) return;
    try {
      const res = await fetch(`${NOTIFY_URL}/recipients/${r.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setRecipients((list) => list.filter((x) => x.id !== r.id));
      showToast(`${r.email} removed`);
    } catch {
      showToast('Could not remove recipient', 'error');
    }
  };

  // ---------------- daily report preview ----------------
  const openPreview = async (date = '') => {
    setPreviewLoading(true);
    setPreviewDate(date);
    try {
      const res = await fetch(`${NOTIFY_URL}/daily-report/preview${date ? `?date=${date}` : ''}`);
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not build the report'));
      setPreview(await res.json());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not build the report', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!settings) {
    return (
      <div style={styles.container} className="page-scroll fade-in">
        <div className="glass-card" style={styles.empty}>
          {loadError ? (
            <>
              <XCircle size={28} color="#ef4444" />
              <p style={{ margin: 0, fontWeight: 600 }}>Could not reach the notification service</p>
              <button className="btn btn-secondary" onClick={refresh}>Try again</button>
            </>
          ) : (
            <>
              <Loader2 size={28} className="notif-spin" color="var(--text-muted)" />
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading notification settings…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const smtpReady = settings.smtp.configured;
  const activeRecipients = recipients.filter((r) => r.is_active);
  const lowStockAudience = activeRecipients.filter((r) => r.receives_low_stock).length;
  const dailyAudience = activeRecipients.filter((r) => r.receives_daily_report).length;
  const zone = settings.timezone;
  const nextReport = formatInZone(settings.next_report_at, zone, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <div style={styles.container} className="page-scroll fade-in">
      <p style={styles.subtitle}>
        Get an email the moment an ingredient runs low, and a sales, profit and insights report every night at closing.
      </p>

      {/* ---------- Connection status ---------- */}
      <div
        className="glass-card"
        style={{ ...styles.banner, borderColor: smtpReady ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.45)' }}
      >
        <div style={{ ...styles.bannerIcon, background: smtpReady ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }}>
          {smtpReady ? <ShieldCheck size={22} color="#10b981" /> : <KeyRound size={22} color="#f59e0b" />}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={styles.bannerTitle}>{smtpReady ? 'Gmail sender connected' : 'Connect a Gmail sender to start emailing'}</h3>
          {smtpReady ? (
            <p style={styles.bannerText}>
              Sending as <b>{settings.smtp.sender}</b> through {settings.smtp.host}. The address and App Password live
              only in the server's environment and are never shown or stored here.
            </p>
          ) : (
            <div style={styles.bannerText}>
              For security, credentials are not entered in the portal. Ask whoever runs the server to:
              <ol style={styles.steps}>
                <li>Turn on 2-Step Verification for the Gmail account, then create an <b>App Password</b>.</li>
                <li>
                  Put both in <code style={styles.code}>backend/.env</code>:{' '}
                  <code style={styles.code}>SMTP_USER=yourstore@gmail.com</code>{' '}
                  <code style={styles.code}>SMTP_APP_PASSWORD=xxxx xxxx xxxx xxxx</code>
                </li>
                <li>Restart the backend. This card turns green when it is connected.</li>
              </ol>
            </div>
          )}
        </div>
        <button
          className="btn btn-secondary"
          disabled={!smtpReady || activeRecipients.length === 0 || busy === 'test'}
          title={!smtpReady ? 'Connect a sender first' : activeRecipients.length === 0 ? 'Add a recipient first' : ''}
          onClick={() => runAction('test', `${NOTIFY_URL}/test`, {}, `Test email sent to ${activeRecipients.length} recipient(s)`)}
        >
          {busy === 'test' ? <Loader2 size={16} className="notif-spin" /> : <Send size={16} />}
          Send test email
        </button>
      </div>

      {smtpReady && activeRecipients.length === 0 && (
        <div style={styles.hint}>
          <AlertTriangle size={16} color="#f59e0b" />
          No one will receive emails yet. Add at least one recipient below.
        </div>
      )}

      <div style={styles.grid}>
        {/* ---------- Low stock ---------- */}
        <section className="glass-card" style={styles.card}>
          <header style={styles.cardHead}>
            <div style={{ ...styles.cardIcon, background: 'rgba(239,68,68,0.12)' }}>
              <BellRing size={18} color="#ef4444" />
            </div>
            <div>
              <h3 style={styles.cardTitle}>Low-stock alerts</h3>
              <span style={styles.cardSub}>{lowStockAudience} recipient(s)</span>
            </div>
          </header>

          <label style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Email me when an ingredient runs low</div>
              <div style={styles.settingHelp}>Sent once when stock reaches its reorder point, and again only after it's been restocked and runs low again.</div>
            </div>
            <Switch
              label="Low-stock emails"
              checked={settings.low_stock_alerts_enabled}
              onChange={(v) => saveSettings({ low_stock_alerts_enabled: v }, v ? 'Low-stock emails on' : 'Low-stock emails off')}
            />
          </label>

          <label style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Pause products that use a low ingredient</div>
              <div style={styles.settingHelp}>Customers and staff see "Unavailable at the moment" until you restock. Your manual Active/Disabled switch is untouched.</div>
            </div>
            <Switch
              label="Auto-pause products"
              checked={settings.auto_pause_products}
              onChange={(v) => saveSettings({ auto_pause_products: v }, v ? 'Products will pause on low stock' : 'Products stay orderable on low stock')}
            />
          </label>

          <div style={styles.statLine}>
            <span style={{ ...styles.statChip, color: settings.low_stock_count ? '#ef4444' : '#10b981' }}>
              {settings.low_stock_count} ingredient(s) low now
            </span>
            <span style={{ ...styles.statChip, color: settings.paused_products.length ? '#f59e0b' : 'var(--text-muted)' }}>
              <PackageX size={13} /> {settings.paused_products.length} product(s) paused
            </span>
          </div>
          {settings.paused_products.length > 0 && (
            <div style={styles.chips}>
              {settings.paused_products.map((name) => (
                <span key={name} style={styles.chip}>{name}</span>
              ))}
            </div>
          )}

          <button
            className="btn btn-secondary"
            style={styles.cardAction}
            disabled={!settings.low_stock_count || busy === 'low'}
            title={settings.low_stock_count ? '' : 'Every ingredient is above its reorder point'}
            onClick={() => runAction('low', `${NOTIFY_URL}/low-stock/send`, {}, 'Low-stock summary sent')}
          >
            {busy === 'low' ? <Loader2 size={16} className="notif-spin" /> : <Mail size={16} />}
            Email the current low-stock list
          </button>
        </section>

        {/* ---------- Daily report ---------- */}
        <section className="glass-card" style={styles.card}>
          <header style={styles.cardHead}>
            <div style={{ ...styles.cardIcon, background: 'rgba(245,158,11,0.12)' }}>
              <CalendarClock size={18} color="#f59e0b" />
            </div>
            <div>
              <h3 style={styles.cardTitle}>End-of-day sales report</h3>
              <span style={styles.cardSub}>{dailyAudience} recipient(s)</span>
            </div>
          </header>

          <label style={styles.settingRow}>
            <div>
              <div style={styles.settingLabel}>Send a report every night at closing</div>
              <div style={styles.settingHelp}>Sales, gross profit, top products, peak hours, inventory watch, plus insights and a conclusion.</div>
            </div>
            <Switch
              label="Daily report"
              checked={settings.daily_report_enabled}
              onChange={(v) => saveSettings({ daily_report_enabled: v }, v ? 'Daily report on' : 'Daily report off')}
            />
          </label>

          <div style={styles.fieldRow}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Closing time</span>
              <input
                type="time"
                className="glass-input"
                value={settings.closing_time}
                onChange={(e) => e.target.value && saveSettings({ closing_time: e.target.value }, 'Closing time saved')}
              />
            </label>
            <label style={{ ...styles.field, flex: 2 }}>
              <span style={styles.fieldLabel}>Time zone</span>
              <select
                className="glass-input"
                value={zone}
                onChange={(e) => saveSettings({ timezone: e.target.value }, 'Time zone saved')}
              >
                {zones.map((z) => (
                  <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
          </div>
          <p style={styles.settingHelp}>
            A store that closes after midnight (say 2:00 AM) still gets one report covering the whole night.
          </p>

          <div style={styles.nextBox}>
            <Clock size={16} color="var(--accent-gold)" />
            {settings.daily_report_enabled ? (
              <span>
                Next report <b>{nextReport}</b> ({untilLabel(settings.next_report_at)})
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Daily report is off</span>
            )}
          </div>
          {settings.last_daily_report && (
            <div style={styles.lastLine}>
              Last report {ago(settings.last_daily_report.created_at)} · <StatusBadge status={settings.last_daily_report.status} />
            </div>
          )}

          <div style={styles.actionRow}>
            <button className="btn btn-secondary" onClick={() => openPreview()} disabled={previewLoading}>
              {previewLoading && !preview ? <Loader2 size={16} className="notif-spin" /> : <Eye size={16} />}
              Preview tonight's report
            </button>
            <button
              className="btn btn-primary"
              disabled={!smtpReady || dailyAudience === 0 || busy === 'daily'}
              title={!smtpReady ? 'Connect a sender first' : dailyAudience === 0 ? 'No one is subscribed to the daily report' : ''}
              onClick={() => runAction('daily', `${NOTIFY_URL}/daily-report/send`, {}, 'Report sent with today’s numbers so far')}
            >
              {busy === 'daily' ? <Loader2 size={16} className="notif-spin" /> : <Send size={16} />}
              Send now
            </button>
          </div>
        </section>
      </div>

      {/* ---------- Recipients ---------- */}
      <section className="glass-card" style={{ ...styles.card, marginTop: 20 }}>
        <header style={styles.cardHead}>
          <div style={{ ...styles.cardIcon, background: 'rgba(59,130,246,0.12)' }}>
            <Users size={18} color="#3b82f6" />
          </div>
          <div>
            <h3 style={styles.cardTitle}>Recipients</h3>
            <span style={styles.cardSub}>Owners and managers who receive these emails. Each person picks which ones.</span>
          </div>
        </header>

        <form onSubmit={addRecipient} style={styles.addForm} noValidate>
          <label style={{ ...styles.field, flex: 2, minWidth: 200 }}>
            <span style={styles.fieldLabel}>Email</span>
            <input
              type="email"
              className="glass-input"
              placeholder="owner@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onBlur={() => newEmail && setEmailTouched(true)}
              aria-invalid={emailTouched && !!emailError}
              style={emailTouched && emailError ? { borderColor: '#ef4444' } : undefined}
            />
            {emailTouched && emailError && <span style={styles.fieldError}>{emailError}</span>}
          </label>
          <label style={{ ...styles.field, flex: 1.4, minWidth: 160 }}>
            <span style={styles.fieldLabel}>Name (optional)</span>
            <input className="glass-input" placeholder="e.g. Store owner" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <div style={{ ...styles.field, minWidth: 190 }}>
            <span style={styles.fieldLabel}>Sends</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className={`notif-pill${newLowStock ? ' is-on' : ''}`} onClick={() => setNewLowStock((v) => !v)}>
                Low stock
              </button>
              <button type="button" className={`notif-pill${newDaily ? ' is-on' : ''}`} onClick={() => setNewDaily((v) => !v)}>
                Daily report
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end' }} disabled={busy === 'add'}>
            {busy === 'add' ? <Loader2 size={16} className="notif-spin" /> : <Plus size={16} />}
            Add recipient
          </button>
        </form>

        {recipients.length === 0 ? (
          <div style={styles.emptyInline}>
            <Mail size={22} color="var(--text-muted)" style={{ opacity: 0.6 }} />
            <span>No recipients yet. Add the owner's email above.</span>
          </div>
        ) : (
          <div style={styles.recipientList}>
            {recipients.map((r) => (
              <div key={r.id} style={{ ...styles.recipientRow, opacity: r.is_active ? 1 : 0.55 }}>
                <div style={styles.avatar}>{(r.name || r.email)[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.recipientName}>{r.name || r.email}</div>
                  {r.name && <div style={styles.recipientEmail}>{r.email}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`notif-pill${r.receives_low_stock ? ' is-on' : ''}`}
                    aria-pressed={r.receives_low_stock}
                    onClick={() => updateRecipient(r, { receives_low_stock: !r.receives_low_stock })}
                  >
                    Low stock
                  </button>
                  <button
                    type="button"
                    className={`notif-pill${r.receives_daily_report ? ' is-on' : ''}`}
                    aria-pressed={r.receives_daily_report}
                    onClick={() => updateRecipient(r, { receives_daily_report: !r.receives_daily_report })}
                  >
                    Daily report
                  </button>
                </div>
                <div style={styles.rowEnd}>
                  <span style={styles.pausedLabel}>{r.is_active ? 'Active' : 'Paused'}</span>
                  <Switch
                    label={`Emails for ${r.email}`}
                    checked={r.is_active}
                    onChange={(v) => updateRecipient(r, { is_active: v })}
                  />
                  <button className="menu-btn-delete" onClick={() => removeRecipient(r)} aria-label={`Remove ${r.email}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Activity ---------- */}
      <section className="glass-card" style={{ ...styles.card, marginTop: 20 }}>
        <header style={styles.cardHead}>
          <div style={{ ...styles.cardIcon, background: 'var(--surface-muted)' }}>
            <FileText size={18} color="var(--text-muted)" />
          </div>
          <div>
            <h3 style={styles.cardTitle}>Recent emails</h3>
            <span style={styles.cardSub}>The last 15 emails the system sent or tried to send.</span>
          </div>
        </header>
        {logs.length === 0 ? (
          <div style={styles.emptyInline}>
            <span>Nothing sent yet.</span>
          </div>
        ) : (
          <div style={styles.logList}>
            {logs.map((log) => (
              <div key={log.id} style={styles.logRow}>
                <StatusBadge status={log.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.logSubject}>{log.subject}</div>
                  <div style={styles.logMeta}>
                    {KIND_LABEL[log.kind]} · {log.recipients.length} recipient(s) · {ago(log.created_at)}
                  </div>
                  {log.error && <div style={styles.logError}>{log.error}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Preview modal ---------- */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Daily report preview">
            <div style={styles.modalHead}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Report preview</h3>
                <span style={styles.cardSub}>{preview.subject}</span>
              </div>
              <button className="modal-close-btn" onClick={() => setPreview(null)} aria-label="Close preview">
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBar}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Business day
                <input
                  type="date"
                  className="glass-input"
                  value={previewDate || preview.summary.business_date}
                  max={settings.current_business_date}
                  onChange={(e) => e.target.value && openPreview(e.target.value)}
                />
              </label>
              {previewLoading && <Loader2 size={16} className="notif-spin" color="var(--text-muted)" />}
              <span style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>
                {money(preview.summary.revenue)} sales · <b>{money(preview.summary.profit)}</b> profit · {preview.summary.margin}% margin
              </span>
            </div>
            <iframe title="Report email preview" srcDoc={preview.html} style={styles.iframe} sandbox="" />
            <div style={styles.modalFoot}>
              <span style={styles.settingHelp}>This is exactly what recipients will see in their inbox.</span>
              <button
                className="btn btn-primary"
                disabled={!smtpReady || dailyAudience === 0 || busy === 'daily'}
                onClick={() =>
                  runAction(
                    'daily',
                    `${NOTIFY_URL}/daily-report/send`,
                    { date: previewDate || preview.summary.business_date },
                    'Report sent'
                  )
                }
              >
                {busy === 'daily' ? <Loader2 size={16} className="notif-spin" /> : <Send size={16} />}
                Email this report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 },
  subtitle: { margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' },
  banner: { display: 'flex', alignItems: 'flex-start', gap: 16, padding: 20, flexWrap: 'wrap', border: '1px solid' },
  bannerIcon: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bannerTitle: { margin: '0 0 4px', fontSize: '1.05rem', color: 'var(--text-primary)' },
  bannerText: { margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 },
  steps: { margin: '8px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 },
  code: { background: 'var(--input-bg)', border: '1px solid var(--border-glass)', borderRadius: 6, padding: '1px 6px', fontSize: '0.8rem', overflowWrap: 'anywhere' },
  hint: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: 'var(--text-secondary)', padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 20 },
  card: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 12 },
  cardIcon: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle: { margin: 0, fontSize: '1rem', color: 'var(--text-primary)' },
  cardSub: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  cardAction: { marginTop: 'auto', justifyContent: 'center' },
  settingRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-muted)', cursor: 'pointer' },
  settingLabel: { fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' },
  settingHelp: { fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 },
  statLine: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  statChip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: 'var(--surface-muted)' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { fontSize: '0.78rem', padding: '3px 9px', borderRadius: 999, border: '1px solid rgba(245,158,11,0.35)', color: 'var(--text-secondary)' },
  fieldRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  fieldLabel: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  fieldError: { fontSize: '0.78rem', color: '#ef4444' },
  nextBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'var(--accent-gold-glow)', fontSize: '0.9rem', color: 'var(--text-primary)' },
  lastLine: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' },
  actionRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 'auto' },
  addForm: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', padding: 14, borderRadius: 12, background: 'var(--surface-muted)' },
  recipientList: { display: 'flex', flexDirection: 'column', gap: 8 },
  recipientRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border-glass)', flexWrap: 'wrap' },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-gold-glow)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
  recipientName: { fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  recipientEmail: { fontSize: '0.82rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowEnd: { display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  pausedLabel: { fontSize: '0.78rem', color: 'var(--text-muted)', width: 44, textAlign: 'right' },
  emptyInline: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.9rem' },
  empty: { padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' },
  logList: { display: 'flex', flexDirection: 'column' },
  logRow: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--table-border)' },
  logSubject: { fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logMeta: { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 },
  logError: { fontSize: '0.8rem', color: '#ef4444', marginTop: 4, lineHeight: 1.4 },
  statusBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: '1px solid', whiteSpace: 'nowrap', flexShrink: 0 },
  modalHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border-glass)' },
  modalBar: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 20px', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-secondary)' },
  iframe: { flex: 1, width: '100%', minHeight: '50vh', border: 'none', background: '#f6efe6' },
  modalFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border-glass)', flexWrap: 'wrap' }
};
