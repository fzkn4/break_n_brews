import React, { useMemo, useState } from 'react';
import { ListOrdered, Search, Pencil, Trash2, Check, X, CalendarClock, AlertTriangle, PackageCheck } from 'lucide-react';
import type { ExpiryStatus, StockBatch } from '../types';
import { EXPIRY_TONE, expiryLabel, formatExpiry, formatQty, parseServerTime } from '../lib/expiry';

interface BatchQueueProps {
  batches: StockBatch[];
  currentUserName: string | null;
  onUpdateBatch: (id: number, data: { batch_code?: string; expiry_date?: string }) => Promise<boolean>;
  onDiscardBatch: (id: number, data: { quantity: number; reason: string; by: string | null }) => Promise<boolean>;
  cardClassName?: string;
}

type Filter = 'all' | 'expired' | 'critical' | 'soon' | 'unknown';

const STATUS_WEIGHT: Record<ExpiryStatus, number> = { expired: 0, critical: 1, soon: 2, unknown: 3, ok: 4 };
const REASONS = ['Expired', 'Spoiled', 'Damaged', 'Other'];

export const BatchQueue: React.FC<BatchQueueProps> = ({
  batches,
  currentUserName,
  onUpdateBatch,
  onDiscardBatch,
  cardClassName = 'glass-card',
}) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id: number; code: string; expiry: string } | null>(null);
  const [discarding, setDiscarding] = useState<{ batch: StockBatch; quantity: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const active = useMemo(() => batches.filter((b) => b.state === 'active'), [batches]);

  const counts = useMemo(() => {
    const c = { all: active.length, expired: 0, critical: 0, soon: 0, unknown: 0 };
    for (const b of active) if (b.expiry_status in c) c[b.expiry_status as keyof typeof c] += 1;
    return c;
  }, [active]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byIngredient = new Map<number, StockBatch[]>();
    for (const b of active) {
      const list = byIngredient.get(b.ingredient_id) || [];
      list.push(b);
      byIngredient.set(b.ingredient_id, list);
    }
    const out: { id: number; name: string; unit: string; category: string; total: number; rows: StockBatch[]; weight: number; soonest: number }[] = [];
    for (const [id, list] of byIngredient) {
      const first = list[0];
      const nameHit = !q || (first.ingredient_name || '').toLowerCase().includes(q);
      const rows = list
        .filter((b) => filter === 'all' || b.expiry_status === filter)
        .filter((b) => nameHit || b.batch_code.toLowerCase().includes(q))
        // Expired first so they get discarded, then the order stock is actually drawn in.
        .sort((a, b) => {
          if ((a.use_rank === null) !== (b.use_rank === null)) return a.use_rank === null ? -1 : 1;
          return (a.use_rank ?? 0) - (b.use_rank ?? 0);
        });
      if (rows.length === 0) continue;
      out.push({
        id,
        name: first.ingredient_name || `Ingredient #${id}`,
        unit: first.ingredient_unit,
        category: first.ingredient_category,
        total: list.reduce((s, b) => s + b.quantity_remaining, 0),
        rows,
        weight: Math.min(...list.map((b) => STATUS_WEIGHT[b.expiry_status])),
        soonest: Math.min(...list.map((b) => (b.days_left ?? 99999))),
      });
    }
    return out.sort((a, b) => a.weight - b.weight || a.soonest - b.soonest || a.name.localeCompare(b.name));
  }, [active, filter, search]);

  const saveEdit = async () => {
    if (!editing || busy) return;
    const original = batches.find((b) => b.id === editing.id);
    const data: { batch_code?: string; expiry_date?: string } = {};
    if (original && editing.code.trim() !== original.batch_code) data.batch_code = editing.code.trim();
    if (original && editing.expiry && editing.expiry !== original.expiry_date) data.expiry_date = editing.expiry;
    if (Object.keys(data).length === 0) {
      setEditing(null);
      return;
    }
    setBusy(true);
    const ok = await onUpdateBatch(editing.id, data);
    setBusy(false);
    if (ok) setEditing(null);
  };

  const confirmDiscard = async () => {
    if (!discarding || busy) return;
    const qty = parseFloat(discarding.quantity);
    if (!(qty > 0) || qty > discarding.batch.quantity_remaining + 1e-6) return;
    setBusy(true);
    const ok = await onDiscardBatch(discarding.batch.id, { quantity: qty, reason: discarding.reason, by: currentUserName });
    setBusy(false);
    if (ok) setDiscarding(null);
  };

  const filters: { id: Filter; label: string; count: number; tone?: ExpiryStatus }[] = [
    { id: 'all', label: 'All batches', count: counts.all },
    { id: 'expired', label: 'Expired', count: counts.expired, tone: 'expired' },
    { id: 'critical', label: 'Use within 2 days', count: counts.critical, tone: 'critical' },
    { id: 'soon', label: 'This week', count: counts.soon, tone: 'soon' },
    { id: 'unknown', label: 'No expiry date', count: counts.unknown, tone: 'unknown' },
  ];

  return (
    <div style={styles.card} className={cardClassName}>
      <div style={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <ListOrdered size={20} color="#3b82f6" />
          <h3 style={styles.cardTitle}>Use-First Queue</h3>
          <div style={{ ...styles.searchBox, marginLeft: 'auto' }}>
            <Search size={14} style={styles.searchIcon} />
            <input
              type="search"
              className="glass-input"
              placeholder="Search ingredient or batch ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '30px' }}
            />
          </div>
        </div>
        <span style={styles.headerDesc}>
          Orders and approved requests draw from batch <strong>#1</strong> first, so open them in this order. Expired
          batches are never ranked. Discard them so the stock count stays honest.
        </span>
        <div style={styles.filterRow}>
          {filters.map((f) => {
            const on = filter === f.id;
            const tone = f.tone ? EXPIRY_TONE[f.tone] : null;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={on}
                style={{
                  ...styles.filterChip,
                  ...(on
                    ? { background: tone ? tone.bg : 'rgba(59,130,246,0.12)', borderColor: tone ? tone.border : 'rgba(59,130,246,0.4)', color: tone ? tone.color : '#3b82f6' }
                    : {}),
                }}
              >
                {tone && <span style={{ ...styles.dot, background: tone.color }} />}
                {f.label}
                <span style={styles.filterCount}>{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={styles.emptyState}>
          <PackageCheck size={30} color="#10b981" style={{ opacity: 0.6 }} />
          <span>
            {active.length === 0
              ? 'No batches on hand yet. Receive a delivery to start the queue.'
              : filter === 'expired'
                ? 'Nothing expired. Nice work.'
                : 'No batches match this filter.'}
          </span>
        </div>
      ) : (
        <div style={styles.groupList}>
          {groups.map((g) => (
            <section key={g.id} style={styles.group}>
              <header style={styles.groupHead}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={styles.groupName}>{g.name}</span>
                  <span style={styles.groupMeta}>{g.category}</span>
                </div>
                <span style={styles.groupTotal}>
                  {formatQty(g.total)} {g.unit} on hand
                </span>
              </header>

              <ol style={styles.batchList}>
                {g.rows.map((b) => {
                  const tone = EXPIRY_TONE[b.expiry_status];
                  const isNext = b.use_rank === 1;
                  const isEditing = editing?.id === b.id;
                  const pct = b.quantity_received > 0 ? Math.min(100, (b.quantity_remaining / b.quantity_received) * 100) : 100;
                  const received = parseServerTime(b.received_at);
                  return (
                    <li
                      key={b.id}
                      style={{
                        ...styles.batch,
                        borderColor: isNext || b.expiry_status === 'expired' ? tone.border : 'var(--border-glass)',
                        background: b.expiry_status === 'expired' ? tone.bg : isNext ? 'var(--surface-muted, rgba(148,118,86,0.05))' : 'transparent',
                      }}
                    >
                      <div style={styles.rankCol}>
                        {b.use_rank === null ? (
                          <span style={{ ...styles.rankPill, color: tone.color, borderColor: tone.border, background: tone.bg }}>
                            <AlertTriangle size={12} /> Discard
                          </span>
                        ) : isNext ? (
                          <span style={{ ...styles.rankPill, color: '#fff', background: tone.color, borderColor: tone.color }}>
                            #1 · Use first
                          </span>
                        ) : (
                          <span style={styles.rankNum}>#{b.use_rank}</span>
                        )}
                      </div>

                      <div style={styles.idCol}>
                        {isEditing ? (
                          <input
                            className="glass-input"
                            value={editing.code}
                            maxLength={60}
                            onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}
                            aria-label="Batch ID"
                          />
                        ) : (
                          <code style={styles.code}>{b.batch_code}</code>
                        )}
                        <span style={styles.meta}>
                          {b.source === 'opening'
                            ? 'Opening stock'
                            : b.source === 'adjustment'
                              ? 'Manual stock adjustment'
                              : `Received ${received ? received.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}`}
                          {b.received_by ? ` · ${b.received_by}` : ''}
                          {b.supplier ? ` · ${b.supplier}` : ''}
                        </span>
                      </div>

                      <div style={styles.qtyCol}>
                        <span style={styles.qty}>
                          {formatQty(b.quantity_remaining)}
                          <span style={styles.qtyOf}> / {formatQty(b.quantity_received)} {g.unit}</span>
                        </span>
                        <div style={styles.bar} aria-hidden>
                          <div style={{ ...styles.barFill, width: `${pct}%`, background: tone.color }} />
                        </div>
                      </div>

                      <div style={styles.expiryCol}>
                        {isEditing ? (
                          <input
                            type="date"
                            className="glass-input"
                            value={editing.expiry}
                            onChange={(e) => setEditing({ ...editing, expiry: e.target.value })}
                            style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.8rem' }}
                            aria-label="Expiry date"
                          />
                        ) : (
                          <>
                            <span style={{ ...styles.statusPill, color: tone.color, background: tone.bg, borderColor: tone.border }}>
                              {expiryLabel(b.days_left)}
                            </span>
                            <span style={styles.meta}>
                              <CalendarClock size={11} style={{ verticalAlign: '-1px', marginRight: 3 }} />
                              {formatExpiry(b.expiry_date)}
                            </span>
                          </>
                        )}
                      </div>

                      <div style={styles.actionCol}>
                        {isEditing ? (
                          <>
                            <button type="button" style={{ ...styles.actionBtn, color: '#10b981' }} onClick={saveEdit} disabled={busy} title="Save">
                              <Check size={15} />
                            </button>
                            <button type="button" style={styles.actionBtn} onClick={() => setEditing(null)} title="Cancel">
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            {b.expiry_status === 'unknown' && (
                              <button
                                type="button"
                                style={{ ...styles.textAction, color: '#f59e0b' }}
                                onClick={() => setEditing({ id: b.id, code: b.batch_code, expiry: '' })}
                              >
                                Add expiry
                              </button>
                            )}
                            <button
                              type="button"
                              style={styles.actionBtn}
                              onClick={() => setEditing({ id: b.id, code: b.batch_code, expiry: b.expiry_date || '' })}
                              title="Edit batch ID or expiry"
                              aria-label={`Edit ${b.batch_code}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              style={{ ...styles.actionBtn, color: b.expiry_status === 'expired' ? '#ef4444' : 'var(--text-muted)' }}
                              onClick={() =>
                                setDiscarding({
                                  batch: b,
                                  quantity: formatQty(b.quantity_remaining),
                                  reason: b.expiry_status === 'expired' ? 'Expired' : 'Spoiled',
                                })
                              }
                              title="Discard (write off) this batch"
                              aria-label={`Discard ${b.batch_code}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {discarding && (
        <div style={styles.overlay} onClick={() => !busy && setDiscarding(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="discard-title">
            <h4 id="discard-title" style={styles.modalTitle}>
              <Trash2 size={18} color="#ef4444" /> Discard batch
            </h4>
            <p style={styles.modalText}>
              <code style={styles.code}>{discarding.batch.batch_code}</code> · {discarding.batch.ingredient_name}
              <br />
              {formatQty(discarding.batch.quantity_remaining)} {discarding.batch.ingredient_unit} left ·{' '}
              {expiryLabel(discarding.batch.days_left).toLowerCase()}
            </p>

            <label style={styles.modalLabel}>Quantity to discard</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="number"
                step="any"
                min="0"
                max={discarding.batch.quantity_remaining}
                className="glass-input"
                value={discarding.quantity}
                onChange={(e) => setDiscarding({ ...discarding, quantity: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', paddingRight: '44px' }}
                autoFocus
              />
              <span style={{ position: 'absolute', right: 12, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {discarding.batch.ingredient_unit}
              </span>
            </div>

            <label style={styles.modalLabel}>Reason</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={discarding.reason === r}
                  onClick={() => setDiscarding({ ...discarding, reason: r })}
                  style={{
                    ...styles.filterChip,
                    ...(discarding.reason === r ? { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' } : {}),
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            <p style={{ ...styles.modalText, fontSize: '0.75rem', marginTop: 14 }}>
              This takes the quantity out of inventory and records who discarded it and why. It cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDiscarding(null)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmDiscard}
                disabled={
                  busy ||
                  !(parseFloat(discarding.quantity) > 0) ||
                  parseFloat(discarding.quantity) > discarding.batch.quantity_remaining + 1e-6
                }
                style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
              >
                <Trash2 size={14} />
                <span>{busy ? 'Discarding…' : 'Discard'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  card: { padding: '24px', display: 'flex', flexDirection: 'column' as const, textAlign: 'left' as const },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '16px',
    marginBottom: '16px',
  },
  cardTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' },
  headerDesc: { fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  searchBox: { position: 'relative' as const, display: 'flex', alignItems: 'center', flex: '0 1 260px', minWidth: '180px' },
  searchIcon: { position: 'absolute' as const, left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' as const },
  filterRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' as const, marginTop: '4px' },
  filterChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '6px 10px',
    borderRadius: '999px',
    border: '1px solid var(--border-glass)',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  filterCount: { fontWeight: 800, opacity: 0.85 },
  dot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  groupList: { display: 'flex', flexDirection: 'column' as const, gap: '18px' },
  group: { display: 'flex', flexDirection: 'column' as const, gap: '8px' },
  groupHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px' },
  groupName: { fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' },
  groupMeta: { fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  groupTotal: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' as const },
  batchList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' as const, gap: '6px' },
  batch: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: '10px 16px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid',
  },
  rankCol: { flex: '0 0 112px' },
  rankPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.7rem',
    fontWeight: 800,
    padding: '4px 9px',
    borderRadius: '999px',
    border: '1px solid',
    whiteSpace: 'nowrap' as const,
  },
  rankNum: { fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', paddingLeft: '8px' },
  idCol: { flex: '1 1 180px', display: 'flex', flexDirection: 'column' as const, gap: '2px', minWidth: 0 },
  code: { fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all' as const },
  meta: { fontSize: '0.7rem', color: 'var(--text-muted)' },
  qtyCol: { flex: '0 1 140px', display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  qty: { fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' },
  qtyOf: { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' },
  bar: { height: 4, borderRadius: 4, background: 'var(--border-glass)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  expiryCol: { flex: '1 1 170px', display: 'flex', flexDirection: 'column' as const, gap: '3px', alignItems: 'flex-start' },
  statusPill: { fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', border: '1px solid' },
  actionCol: { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '2px', marginLeft: 'auto' },
  actionBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '6px',
    display: 'flex',
  },
  textAction: { background: 'none', border: 'none', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', padding: '4px 6px' },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '160px',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    textAlign: 'center' as const,
  },
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'var(--modal-overlay, rgba(0,0,0,0.5))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
    backdropFilter: 'blur(4px)',
  },
  modal: {
    width: '100%',
    maxWidth: '420px',
    background: 'var(--dropdown-bg, var(--card-bg, #fff))',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-glass)',
    borderRadius: '16px',
    padding: '22px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
    textAlign: 'left' as const,
  },
  modalTitle: { margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' },
  modalText: { margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 },
  modalLabel: { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', margin: '12px 0 6px' },
};
