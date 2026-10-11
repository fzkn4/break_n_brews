import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Plus, Truck, Trash2, CalendarClock, Hash, AlertTriangle, Layers, Info } from 'lucide-react';
import type { Ingredient, StockBatch, StockInPayload } from '../types';
import {
  addDaysInput, daysUntil, expiryLabel, formatExpiry, formatQty, statusForDays, todayInput, EXPIRY_TONE,
} from '../lib/expiry';

/** Pre-fills the form, e.g. from an approved staff request. `key` changes on every fill. */
export interface StockInPrefill {
  key: number;
  ingredientId: number;
  quantity: number;
  cost?: string;
  supplier?: string;
  invoiceNumber?: string;
  requestId?: number;
}

interface ReceiveStockFormProps {
  ingredients: Ingredient[];
  batches: StockBatch[];
  /** Admin enters the invoice cost; staff may leave it blank to value the stock at the current unit cost. */
  costRequired: boolean;
  receivedBy: string | null;
  prefill?: StockInPrefill | null;
  onSubmit: (payload: StockInPayload) => Promise<boolean>;
  onSubmitted?: (prefill: StockInPrefill | null) => void;
  cardClassName?: string;
}

interface BatchRow {
  uid: number;
  quantity: string;
  batchCode: string;
  expiry: string;
}

let rowSeq = 0;
const newRow = (quantity = ''): BatchRow => ({ uid: ++rowSeq, quantity, batchCode: '', expiry: '' });

const QUICK_PICKS: { label: string; days: number }[] = [
  { label: '+1 wk', days: 7 },
  { label: '+1 mo', days: 30 },
  { label: '+3 mo', days: 90 },
  { label: '+1 yr', days: 365 },
];

export const ReceiveStockForm: React.FC<ReceiveStockFormProps> = ({
  ingredients,
  batches,
  costRequired,
  receivedBy,
  prefill,
  onSubmit,
  onSubmitted,
  cardClassName = 'glass-card',
}) => {
  const [ingredientId, setIngredientId] = useState('');
  const [rows, setRows] = useState<BatchRow[]>(() => [newRow()]);
  const [cost, setCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [activePrefill, setActivePrefill] = useState<StockInPrefill | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keptDelivery, setKeptDelivery] = useState(false);
  const firstExpiryRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!prefill) return;
    setIngredientId(String(prefill.ingredientId));
    setRows([newRow(String(prefill.quantity))]);
    setCost(prefill.cost ?? '');
    setSupplier(prefill.supplier ?? '');
    setInvoiceNumber(prefill.invoiceNumber ?? '');
    setActivePrefill(prefill);
    setTriedSubmit(false);
    setKeptDelivery(false);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // The one thing a request cannot tell us is the expiry date, so put the cursor there.
    setTimeout(() => firstExpiryRef.current?.focus(), 350);
    // Re-fill only when a new prefill is issued, not when the parent re-renders the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.key]);

  const selected = ingredients.find((i) => i.id === Number(ingredientId));
  const unit = selected?.unit || 'units';
  const today = todayInput();

  const groupedIngredients = useMemo(() => {
    const groups = new Map<string, Ingredient[]>();
    for (const ing of ingredients) {
      const list = groups.get(ing.category) || [];
      list.push(ing);
      groups.set(ing.category, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [ingredients]);

  const onHand = useMemo(() => {
    if (!selected) return null;
    const mine = batches.filter((b) => b.ingredient_id === selected.id && b.state === 'active');
    const next = mine.filter((b) => b.use_rank !== null).sort((a, b) => (a.use_rank ?? 0) - (b.use_rank ?? 0))[0];
    const expired = mine.filter((b) => b.expiry_status === 'expired');
    return { count: mine.length, next, expired };
  }, [selected, batches]);

  const totalQty = rows.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
  const estimatedCost = selected ? selected.cost_per_unit * totalQty : 0;

  const rowErrors = rows.map((r) => {
    const errs: { quantity?: string; expiry?: string } = {};
    if (!(parseFloat(r.quantity) > 0)) errs.quantity = 'Enter how much arrived';
    if (!r.expiry) errs.expiry = 'Expiry date is required';
    else if (r.expiry < today) errs.expiry = 'This date has already passed';
    return errs;
  });
  const duplicateCodes = (() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const r of rows) {
      const c = r.batchCode.trim().toUpperCase();
      if (!c) continue;
      if (seen.has(c)) dupes.add(c);
      seen.add(c);
    }
    return dupes;
  })();
  const hasErrors =
    !ingredientId ||
    rowErrors.some((e) => e.quantity || e.expiry) ||
    duplicateCodes.size > 0 ||
    (costRequired && !(parseFloat(cost) > 0)) ||
    !supplier.trim();

  const shortLived = rows
    .map((r, i) => ({ i, days: r.expiry ? daysUntil(r.expiry) : null }))
    .filter((x) => x.days !== null && x.days >= 0 && x.days <= 2);

  const updateRow = (uid: number, patch: Partial<BatchRow>) =>
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  const resetAfterSave = () => {
    setIngredientId('');
    setRows([newRow()]);
    setCost('');
    setActivePrefill(null);
    setTriedSubmit(false);
    // A delivery usually brings several ingredients: keep who it came from for the next one.
    setKeptDelivery(Boolean(supplier.trim() || invoiceNumber.trim()));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTriedSubmit(true);
    if (hasErrors || saving) return;
    setSaving(true);
    const ok = await onSubmit({
      ingredient_id: Number(ingredientId),
      supplier: supplier.trim(),
      cost: cost.trim() ? parseFloat(cost) : null,
      invoice_number: invoiceNumber.trim() || null,
      received_by: receivedBy,
      batches: rows.map((r) => ({
        quantity: parseFloat(r.quantity),
        batch_code: r.batchCode.trim() || null,
        expiry_date: r.expiry,
      })),
    });
    setSaving(false);
    if (ok) {
      onSubmitted?.(activePrefill);
      resetAfterSave();
    }
  };

  const show = (msg?: string) => (triedSubmit && msg ? <span style={styles.fieldError}>{msg}</span> : null);

  return (
    <div style={styles.card} className={cardClassName}>
      <div style={styles.cardHeader}>
        <div style={styles.headerTitleGroup}>
          <Archive size={20} color="#f59e0b" />
          <h3 style={styles.cardTitle}>Receive Stock</h3>
        </div>
        <span style={styles.headerDesc}>
          Log a delivery batch by batch. Each batch keeps its own ID and expiry date, and stock is always used
          soonest-expiry first.
        </span>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} style={styles.formBody} noValidate>
        {activePrefill?.requestId && (
          <div style={{ ...styles.notice, borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.08)' }}>
            <Info size={14} color="#10b981" style={{ flexShrink: 0 }} />
            <span>
              Filled from staff request <strong>REQ-{activePrefill.requestId}</strong>. Add the expiry date from the
              package to finish.
            </span>
            <button type="button" style={styles.linkBtn} onClick={resetAfterSave}>Cancel</button>
          </div>
        )}

        <div style={styles.inputGroup}>
          <label style={styles.label} htmlFor="rs-ingredient">Ingredient</label>
          <select
            id="rs-ingredient"
            className="glass-input"
            value={ingredientId}
            onChange={(e) => setIngredientId(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="" disabled>Choose what arrived…</option>
            {groupedIngredients.map(([category, list]) => (
              <optgroup key={category} label={category}>
                {list.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} · {formatQty(ing.stock_level)} {ing.unit} on hand
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {show(!ingredientId ? 'Choose an ingredient' : undefined)}

          {selected && onHand && (
            <div style={styles.onHand}>
              <Layers size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>
                  <strong>{formatQty(selected.stock_level)} {unit}</strong> on hand in {onHand.count}{' '}
                  {onHand.count === 1 ? 'batch' : 'batches'}
                  {selected.lifespan_days ? ` · typical shelf life ${selected.lifespan_days} days` : ''}
                </span>
                {onHand.next && (
                  <span>
                    Next to use: <code style={styles.code}>{onHand.next.batch_code}</code>{' '}
                    <span style={{ color: EXPIRY_TONE[onHand.next.expiry_status].color, fontWeight: 600 }}>
                      {expiryLabel(onHand.next.days_left).toLowerCase()}
                    </span>
                  </span>
                )}
                {onHand.expired.length > 0 && (
                  <span style={{ color: EXPIRY_TONE.expired.color, fontWeight: 600 }}>
                    {onHand.expired.length} expired {onHand.expired.length === 1 ? 'batch' : 'batches'} waiting to be
                    discarded
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Batches */}
        <div style={styles.inputGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label style={styles.label}>
              {rows.length > 1 ? `Batches in this delivery (${rows.length})` : 'Batch details'}
            </label>
            <span style={styles.hint}>Different expiry dates? Split them into batches.</span>
          </div>

          {rows.map((row, idx) => {
            const errs = rowErrors[idx];
            const days = row.expiry ? daysUntil(row.expiry) : null;
            const tone = EXPIRY_TONE[statusForDays(days)];
            const dupe = duplicateCodes.has(row.batchCode.trim().toUpperCase());
            return (
              <div key={row.uid} style={styles.batchRow}>
                <div style={styles.batchRowHead}>
                  <span style={styles.batchIndex}>Batch {idx + 1}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      style={styles.iconBtn}
                      onClick={() => setRows((prev) => prev.filter((r) => r.uid !== row.uid))}
                      title="Remove this batch"
                      aria-label={`Remove batch ${idx + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div style={styles.inputRow}>
                  <div style={{ ...styles.inputGroup, flex: '1 1 120px' }}>
                    <label style={styles.subLabel}>Quantity</label>
                    <div style={styles.inputWithSuffix}>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        placeholder="e.g. 12"
                        className="glass-input"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.uid, { quantity: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', paddingRight: '44px' }}
                      />
                      <span style={styles.suffixText}>{unit}</span>
                    </div>
                    {show(errs.quantity)}
                  </div>

                  <div style={{ ...styles.inputGroup, flex: '1 1 160px' }}>
                    <label style={styles.subLabel}>Batch / Lot ID</label>
                    <div style={styles.inputWithPrefix}>
                      <Hash size={13} style={styles.prefixIcon} />
                      <input
                        type="text"
                        placeholder="Auto-generated if blank"
                        className="glass-input"
                        value={row.batchCode}
                        maxLength={60}
                        onChange={(e) => updateRow(row.uid, { batchCode: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '28px', fontFamily: 'ui-monospace, monospace' }}
                      />
                    </div>
                    {dupe && <span style={styles.fieldError}>Same ID used twice in this delivery</span>}
                  </div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.subLabel}>Expiry date</label>
                  <div style={styles.inputWithPrefix}>
                      <CalendarClock size={14} style={styles.prefixIcon} />
                      <input
                        ref={idx === 0 ? firstExpiryRef : undefined}
                        type="date"
                        min={today}
                        className="glass-input"
                        value={row.expiry}
                        onChange={(e) => updateRow(row.uid, { expiry: e.target.value })}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          paddingLeft: '30px',
                          borderColor: triedSubmit && errs.expiry ? '#ef4444' : undefined,
                        }}
                      />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    {selected?.lifespan_days ? (
                      <button
                        type="button"
                        style={{ ...styles.chip, ...styles.chipSuggested }}
                        onClick={() => updateRow(row.uid, { expiry: addDaysInput(selected.lifespan_days || 0) })}
                        title={`Typical shelf life for ${selected.name}`}
                      >
                        Typical · {selected.lifespan_days}d
                      </button>
                    ) : null}
                    {QUICK_PICKS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        style={styles.chip}
                        onClick={() => updateRow(row.uid, { expiry: addDaysInput(p.days) })}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {row.expiry && !errs.expiry ? (
                    <span style={{ ...styles.expiryHint, color: tone.color }}>
                      {expiryLabel(days)} · {formatExpiry(row.expiry)}
                    </span>
                  ) : (
                    show(errs.expiry) || (
                      <span style={styles.hint}>Use the date printed on the package (best before / use by).</span>
                    )
                  )}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '8px 12px' }}
            onClick={() => setRows((prev) => [...prev, newRow()])}
          >
            <Plus size={14} />
            <span>Add another batch</span>
          </button>
        </div>

        <div style={styles.inputRow}>
          <div style={{ ...styles.inputGroup, flex: '1 1 160px' }}>
            <label style={styles.label}>
              Total cost (₱){costRequired ? '' : ' · optional'}
            </label>
            <div style={styles.inputWithPrefix}>
              <span style={{ ...styles.prefixIcon, fontSize: '14px', fontWeight: 700 }}>₱</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder={!costRequired && estimatedCost > 0 ? `≈ ${estimatedCost.toFixed(2)} at current cost` : 'e.g. 6000.00'}
                className="glass-input"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '28px' }}
              />
            </div>
            {show(costRequired && !(parseFloat(cost) > 0) ? 'Enter the shipment cost' : undefined)}
          </div>

          <div style={{ ...styles.inputGroup, flex: '1 1 160px' }}>
            <label style={styles.label}>Supplier</label>
            <div style={styles.inputWithPrefix}>
              <Truck size={14} style={styles.prefixIcon} />
              <input
                type="text"
                placeholder="e.g. Valley View Farms"
                className="glass-input"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '28px' }}
              />
            </div>
            {show(!supplier.trim() ? 'Who delivered it?' : undefined)}
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Invoice number · optional</label>
          <input
            type="text"
            placeholder="e.g. INV-99881"
            className="glass-input"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          {keptDelivery && (
            <span style={styles.hint}>
              Kept the supplier and invoice for the next item in this delivery.{' '}
              <button
                type="button"
                style={{ ...styles.linkBtn, marginLeft: 0 }}
                onClick={() => { setSupplier(''); setInvoiceNumber(''); setKeptDelivery(false); }}
              >
                Clear
              </button>
            </span>
          )}
        </div>

        {shortLived.length > 0 && (
          <div style={{ ...styles.notice, borderColor: EXPIRY_TONE.critical.border, background: EXPIRY_TONE.critical.bg }}>
            <AlertTriangle size={14} color={EXPIRY_TONE.critical.color} style={{ flexShrink: 0 }} />
            <span>
              {shortLived.map((s) => `Batch ${s.i + 1}`).join(', ')} {shortLived.length === 1 ? 'expires' : 'expire'}{' '}
              within 2 days and will go to the front of the use-first queue.
            </span>
          </div>
        )}

        <div style={styles.summary}>
          <span>
            {totalQty > 0 ? (
              <>
                Receiving <strong>{formatQty(totalQty)} {unit}</strong> in {rows.length}{' '}
                {rows.length === 1 ? 'batch' : 'batches'}
                {selected && (
                  <> · stock {formatQty(selected.stock_level)} → <strong>{formatQty(selected.stock_level + totalQty)} {unit}</strong></>
                )}
              </>
            ) : (
              'Enter the quantity for each batch'
            )}
          </span>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ justifyContent: 'center', opacity: saving ? 0.7 : 1 }}
          disabled={saving}
        >
          <Plus size={16} />
          <span>{saving ? 'Saving…' : rows.length > 1 ? `Receive ${rows.length} batches` : 'Receive batch'}</span>
        </button>
      </form>
    </div>
  );
};

const styles = {
  card: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const,
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '16px',
    marginBottom: '20px',
  },
  headerTitleGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  cardTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' },
  headerDesc: { fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  formBody: { display: 'flex', flexDirection: 'column' as const, gap: '16px', scrollMarginTop: '24px' },
  inputGroup: { display: 'flex', flexDirection: 'column' as const, gap: '6px', minWidth: 0 },
  inputRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' as const },
  label: { fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 },
  subLabel: { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  hint: { fontSize: '0.72rem', color: 'var(--text-muted)' },
  fieldError: { fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 },
  expiryHint: { fontSize: '0.75rem', fontWeight: 700 },
  inputWithSuffix: { position: 'relative' as const, display: 'flex', alignItems: 'center' },
  suffixText: { position: 'absolute' as const, right: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 },
  inputWithPrefix: { position: 'relative' as const, display: 'flex', alignItems: 'center' },
  prefixIcon: { position: 'absolute' as const, left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' as const },
  onHand: {
    display: 'flex',
    gap: '8px',
    fontSize: '0.76rem',
    color: 'var(--text-muted)',
    background: 'var(--surface-muted, rgba(148,118,86,0.06))',
    border: '1px solid var(--border-glass)',
    borderRadius: '10px',
    padding: '10px 12px',
    lineHeight: 1.45,
  },
  code: { fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)' },
  batchRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid var(--border-glass)',
    background: 'var(--surface-muted, rgba(148,118,86,0.04))',
  },
  batchRowHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  batchIndex: { fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
  },
  chip: {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '6px 9px',
    borderRadius: '999px',
    border: '1px solid var(--border-glass)',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  chipSuggested: {
    color: '#f59e0b',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    background: 'rgba(245, 158, 11, 0.08)',
  },
  notice: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.76rem',
    color: 'var(--text-primary)',
    border: '1px solid',
    borderRadius: '10px',
    padding: '10px 12px',
    lineHeight: 1.4,
  },
  linkBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    padding: 0,
    color: '#f59e0b',
    fontWeight: 700,
    fontSize: '0.75rem',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  summary: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    borderTop: '1px dashed var(--border-glass)',
    paddingTop: '12px',
  },
};
