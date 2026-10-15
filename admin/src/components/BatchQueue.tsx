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
    const out: { id: number; name: string; unit: string; category: string; total: number; expiredTotal: number; rows: StockBatch[]; weight: number; soonest: number }[] = [];
    for (const [id, list] of byIngredient) {
      const first = list[0];
      const nameHit = !q || (first.ingredient_name || '').toLowerCase().includes(q);
      const rows = list
        .filter((b) => filter === 'all' || b.expiry_status === filter)
        .filter((b) => nameHit || b.batch_code.toLowerCase().includes(q))
        // Expired first so they get discarded, then earliest expiry, then use_rank FIFO
        .sort((a, b) => {
          // 1. Expired batches at the top
          const aExp = a.expiry_status === 'expired' || (a.days_left !== null && a.days_left < 0);
          const bExp = b.expiry_status === 'expired' || (b.days_left !== null && b.days_left < 0);
          if (aExp !== bExp) return aExp ? -1 : 1;

          // 2. Earliest expiry date
          if (a.expiry_date && b.expiry_date) {
            if (a.expiry_date !== b.expiry_date) return a.expiry_date.localeCompare(b.expiry_date);
          } else if (a.expiry_date && !b.expiry_date) {
            return -1;
          } else if (!a.expiry_date && b.expiry_date) {
            return 1;
          }

          // 3. FIFO / use_rank fallback
          if (a.use_rank !== null && b.use_rank !== null) return a.use_rank - b.use_rank;
          return (a.id || 0) - (b.id || 0);
        });
      if (rows.length === 0) continue;
      const usableList = list.filter((b) => b.expiry_status !== 'expired');
      const expiredList = list.filter((b) => b.expiry_status === 'expired');
      out.push({
        id,
        name: first.ingredient_name || `Ingredient #${id}`,
        unit: first.ingredient_unit,
        category: first.ingredient_category,
        total: usableList.reduce((s, b) => s + b.quantity_remaining, 0),
        expiredTotal: expiredList.reduce((s, b) => s + b.quantity_remaining, 0),
        rows,
        weight: Math.min(...list.map((b) => STATUS_WEIGHT[b.expiry_status])),
        soonest: Math.min(...list.map((b) => (b.days_left ?? 99999))),
      });
    }
    // Alphabetical Sorting (A to Z) by Ingredient Name
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
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

  const filters: { id: Filter; label: string; count: number; tone?: ExpiryStatus; isExpiredFilter?: boolean }[] = [
    { id: 'all', label: 'All batches', count: counts.all },
    { id: 'expired', label: 'Expired', count: counts.expired, isExpiredFilter: true },
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
            const isExp = f.isExpiredFilter;
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
                    ? isExp
                      ? { background: 'rgba(255, 77, 77, 0.18)', borderColor: '#FF4D4D', color: '#FF4D4D' }
                      : { background: tone ? tone.bg : 'rgba(59,130,246,0.12)', borderColor: tone ? tone.border : 'rgba(59,130,246,0.4)', color: tone ? tone.color : '#3b82f6' }
                    : {}),
                }}
              >
                {isExp ? (
                  <span style={{ ...styles.dot, background: '#FF4D4D' }} />
                ) : (
                  tone && <span style={{ ...styles.dot, background: tone.color }} />
                )}
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
              ? 'No batches on hand yet. Stock in a delivery to start the queue.'
              : filter === 'expired'
                ? 'Nothing expired. Nice work.'
                : 'No batches match this filter.'}
          </span>
        </div>
      ) : (
        <div style={styles.groupList}>
          {groups.map((g) => (
            <section key={g.id} style={styles.groupCard} className="glass-card">
              <header style={styles.groupHead}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                  <span style={styles.groupName} title={g.name}>{g.name}</span>
                  <span style={styles.groupMeta}>{g.category}</span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                  <span style={styles.groupTotal}>
                    <strong style={{ color: '#FFFFFF', fontSize: '0.88rem', fontWeight: 800 }}>{formatQty(g.total)}</strong>{' '}
                    <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{g.unit} on hand</span>
                  </span>
                  {g.expiredTotal > 0 && (
                    <span style={styles.expiredBadgeTotal}>
                      +{formatQty(g.expiredTotal)} {g.unit} expired
                    </span>
                  )}
                </div>
              </header>

              <ol style={styles.batchList}>
                {g.rows.map((b) => {
                  const tone = EXPIRY_TONE[b.expiry_status];
                  const isExpired = b.expiry_status === 'expired' || (b.days_left !== null && b.days_left < 0);
                  const isNext = b.use_rank === 1 && !isExpired;
                  const isEditing = editing?.id === b.id;
                  const pct = b.quantity_received > 0 ? Math.min(100, (b.quantity_remaining / b.quantity_received) * 100) : 100;
                  const received = parseServerTime(b.received_at);
                  return (
                    <li
                      key={b.id}
                      style={{
                        ...styles.batch,
                        borderColor: isExpired
                          ? '#FF4D4D'
                          : isNext
                            ? '#f97316'
                            : 'rgba(255, 255, 255, 0.08)',
                        background: isExpired
                          ? 'rgba(255, 77, 77, 0.08)'
                          : isNext
                            ? 'rgba(249, 115, 22, 0.06)'
                            : 'rgba(18, 18, 22, 0.65)',
                      }}
                    >
                      {/* Top Row: Rank badge, Batch ID, and Action buttons */}
                      <div style={styles.batchTopRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          {isExpired || b.use_rank === null ? (
                            <span style={styles.rankPillExpired}>
                              <AlertTriangle size={12} color="#FFFFFF" /> Discard
                            </span>
                          ) : isNext ? (
                            <span style={styles.rankPillNext}>
                              #1 · Use first
                            </span>
                          ) : (
                            <span style={styles.rankNum}>#{b.use_rank}</span>
                          )}

                          {isEditing ? (
                            <input
                              className="glass-input"
                              value={editing.code}
                              maxLength={60}
                              onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                              style={{ flex: 1, minWidth: '90px', boxSizing: 'border-box', fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem', padding: '4px 8px' }}
                              aria-label="Batch ID"
                            />
                          ) : (
                            <code style={styles.code}>{b.batch_code}</code>
                          )}
                        </div>

                        <div style={styles.actionCol}>
                          {isEditing ? (
                            <>
                              <button type="button" style={{ ...styles.actionBtn, color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.35)' }} onClick={saveEdit} disabled={busy} title="Save">
                                <Check size={14} />
                              </button>
                              <button type="button" style={styles.actionBtn} onClick={() => setEditing(null)} title="Cancel">
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              {b.expiry_status === 'unknown' && (
                                <button
                                  type="button"
                                  style={styles.textAction}
                                  onClick={() => setEditing({ id: b.id, code: b.batch_code, expiry: '' })}
                                >
                                  + Expiry
                                </button>
                              )}
                              <button
                                type="button"
                                style={styles.actionBtn}
                                onClick={() => setEditing({ id: b.id, code: b.batch_code, expiry: b.expiry_date || '' })}
                                title="Edit batch ID or expiry"
                                aria-label={`Edit ${b.batch_code}`}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                style={isExpired ? styles.actionBtnDiscard : styles.actionBtn}
                                onClick={() =>
                                  setDiscarding({
                                    batch: b,
                                    quantity: formatQty(b.quantity_remaining),
                                    reason: isExpired ? 'Expired' : 'Spoiled',
                                  })
                                }
                                title="Discard (write off) this batch"
                                aria-label={`Discard ${b.batch_code}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Quantity & Progress */}
                      <div style={styles.qtyRow}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={styles.qtyLabel}>Remaining stock</span>
                          <span style={styles.qty}>
                            {formatQty(b.quantity_remaining)}
                            <span style={styles.qtyOf}> / {formatQty(b.quantity_received)} {g.unit}</span>
                          </span>
                        </div>
                        <div style={styles.bar} aria-hidden>
                          <div style={{ ...styles.barFill, width: `${pct}%`, background: isExpired ? '#FF4D4D' : isNext ? '#f97316' : tone.color }} />
                        </div>
                      </div>

                      {/* Expiry Pill, Calendar Date & Origin */}
                      <div style={styles.expiryRow}>
                        {isEditing ? (
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Expiry date:</label>
                            <input
                              type="date"
                              className="glass-input"
                              value={editing.expiry}
                              onChange={(e) => setEditing({ ...editing, expiry: e.target.value })}
                              style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.82rem', padding: '4px 8px' }}
                              aria-label="Expiry date"
                            />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '6px' }}>
                            <span
                              style={{
                                ...styles.statusPill,
                                color: isExpired ? '#FFFFFF' : tone.color,
                                background: isExpired ? '#FF4D4D' : tone.bg,
                                borderColor: isExpired ? '#FF4D4D' : tone.border,
                              }}
                            >
                              {expiryLabel(b.days_left)}
                            </span>
                            <span style={styles.metaExpiry}>
                              <CalendarClock size={12} style={{ verticalAlign: '-1px', marginRight: 4, color: isExpired ? '#FF4D4D' : '#94a3b8' }} />
                              {formatExpiry(b.expiry_date)}
                            </span>
                          </div>
                        )}

                        <span style={styles.metaOrigin}>
                          {b.source === 'opening'
                            ? 'Opening stock'
                            : b.source === 'adjustment'
                              ? 'Manual adjustment'
                              : `Received ${received ? received.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}`}
                          {b.received_by ? ` · ${b.received_by}` : ''}
                          {b.supplier ? ` · ${b.supplier}` : ''}
                        </span>
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
              <Trash2 size={18} color="#FF4D4D" /> Discard batch
            </h4>
            <p style={styles.modalText}>
              <code style={styles.code}>{discarding.batch.batch_code}</code> · {discarding.batch.ingredient_name}
              <br />
              {formatQty(discarding.batch.quantity_remaining)} {discarding.batch.ingredient_unit} left ·{' '}
              {expiryLabel(discarding.batch.days_left).toLowerCase()}
            </p>

            <label style={styles.modalLabel}>Quantity to write off</label>
            <input
              type="number"
              step="any"
              min="0"
              max={discarding.batch.quantity_remaining}
              className="glass-input"
              value={discarding.quantity}
              onChange={(e) => setDiscarding({ ...discarding, quantity: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />

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
                    ...(discarding.reason === r ? { background: 'rgba(255,77,77,0.18)', borderColor: '#FF4D4D', color: '#FF4D4D' } : {}),
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
                style={{ background: '#FF4D4D', borderColor: '#FF4D4D', color: '#fff' }}
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
  card: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const,
    background: '#121212',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '16px',
    marginBottom: '16px',
  },
  cardTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#FFFFFF' },
  headerDesc: { fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.45 },
  searchBox: { position: 'relative' as const, display: 'flex', alignItems: 'center', flex: '0 1 260px', minWidth: '180px' },
  searchIcon: { position: 'absolute' as const, left: '10px', color: '#94A3B8', pointerEvents: 'none' as const },
  filterRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' as const, marginTop: '4px' },
  filterChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '6px 10px',
    borderRadius: '999px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'transparent',
    color: '#94A3B8',
    cursor: 'pointer',
  },
  filterCount: { fontWeight: 800, opacity: 0.85 },
  dot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  groupList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '18px',
    width: '100%',
    alignItems: 'start',
    boxSizing: 'border-box' as const,
  },
  groupCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
    background: 'rgba(18, 18, 22, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '16px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
    boxSizing: 'border-box' as const,
    minWidth: 0,
    transition: 'border-color 0.2s ease, transform 0.2s ease',
  },
  groupHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  groupName: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: '-0.01em',
    lineHeight: 1.25,
    wordBreak: 'break-word' as const,
  },
  groupMeta: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  groupTotal: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#FFFFFF',
    whiteSpace: 'nowrap' as const,
    background: 'rgba(255, 255, 255, 0.06)',
    padding: '4px 10px',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  expiredBadgeTotal: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.7rem',
    color: '#FF4D4D',
    fontWeight: 700,
  },
  batchList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  batch: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxSizing: 'border-box' as const,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
  },
  batchTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  rankPillExpired: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.7rem',
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: '999px',
    border: '1px solid #FF4D4D',
    background: '#FF4D4D',
    color: '#FFFFFF',
    whiteSpace: 'nowrap' as const,
    letterSpacing: '0.02em',
    boxShadow: '0 2px 8px rgba(255, 77, 77, 0.35)',
    flexShrink: 0,
  },
  rankPillNext: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.7rem',
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: '999px',
    border: '1px solid #f97316',
    background: '#f97316',
    color: '#FFFFFF',
    whiteSpace: 'nowrap' as const,
    boxShadow: '0 2px 8px rgba(249, 115, 22, 0.35)',
    flexShrink: 0,
  },
  rankNum: {
    fontSize: '0.8rem',
    fontWeight: 800,
    color: '#94A3B8',
    padding: '2px 6px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.05)',
    flexShrink: 0,
  },
  code: {
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.82rem',
    fontWeight: 800,
    color: '#FFFFFF',
    wordBreak: 'break-all' as const,
  },
  actionCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  actionBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    color: '#E2E8F0',
    cursor: 'pointer',
    padding: '5px 7px',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  actionBtnDiscard: {
    background: 'rgba(255, 77, 77, 0.14)',
    border: '1px solid #FF4D4D',
    color: '#FF4D4D',
    cursor: 'pointer',
    padding: '5px 7px',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  textAction: {
    background: 'rgba(200, 157, 102, 0.16)',
    border: '1px solid rgba(200, 157, 102, 0.4)',
    color: '#C89D66',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
  },
  qtyRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  qtyLabel: {
    fontSize: '0.72rem',
    color: '#94A3B8',
    fontWeight: 600,
  },
  qty: {
    fontSize: '0.88rem',
    fontWeight: 800,
    color: '#FFFFFF',
  },
  qtyOf: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#94A3B8',
  },
  bar: {
    height: 5,
    borderRadius: 4,
    background: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  expiryRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    paddingTop: '6px',
    borderTop: '1px dashed rgba(255, 255, 255, 0.06)',
  },
  statusPill: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '999px',
    border: '1px solid',
    display: 'inline-flex',
    alignItems: 'center',
  },
  metaExpiry: {
    fontSize: '0.72rem',
    color: '#CBD5E1',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
  },
  metaOrigin: {
    fontSize: '0.68rem',
    color: '#94A3B8',
    fontWeight: 500,
    lineHeight: 1.3,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    minHeight: '160px',
    color: '#94A3B8',
    fontSize: '0.85rem',
    textAlign: 'center' as const,
  },
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
    backdropFilter: 'blur(6px)',
  },
  modal: {
    width: '100%',
    maxWidth: '420px',
    background: '#121212',
    color: '#FFFFFF',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
    textAlign: 'left' as const,
  },
  modalTitle: { margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' },
  modalText: { margin: '0 0 12px', fontSize: '0.85rem', color: '#CBD5E1', lineHeight: 1.5 },
  modalLabel: { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#CBD5E1', margin: '12px 0 6px' },
};
