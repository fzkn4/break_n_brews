import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Plus, Trash2, CalendarClock, Hash, AlertTriangle, Layers, Info, X } from 'lucide-react';
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
  costRequired?: boolean;
  receivedBy: string | null;
  prefill?: StockInPrefill | null;
  onSubmit: (payload: StockInPayload) => Promise<boolean>;
  onSubmitted?: (prefill: StockInPrefill | null) => void;
  onCreateIngredient?: (data: any) => Promise<Ingredient | null>;
  cardClassName?: string;
}

const ALL_CATEGORIES = [
  'Dairy',
  'Coffee Beans',
  'Syrups',
  'Packaging',
  'Beverages',
  'Meat',
  'Pastries',
  'Grains',
  'Sweeteners',
];

const ALL_UNITS = ['kg', 'mg', 'L', 'ml', 'pcs'];

interface BatchRow {
  uid: number;
  quantity: string;
  batchCode: string;
  expiry: string;
}

const CATEGORY_LIFESPAN_DAYS: Record<string, number> = {
  Dairy: 7,
  Meat: 5,
  Pastries: 14,
  'Coffee Beans': 60,
  Syrups: 90,
  Packaging: 365,
  Beverages: 180,
  Grains: 180,
  Sweeteners: 365,
};

const getCalculatedLifespan = (ing?: Ingredient | null): number => {
  if (!ing) return 30;
  return ing.lifespan_days ?? CATEGORY_LIFESPAN_DAYS[ing.category] ?? 30;
};

let rowSeq = 0;
const newRow = (quantity = '', expiry = ''): BatchRow => ({ uid: ++rowSeq, quantity, batchCode: '', expiry });

const QUICK_PICKS: { label: string; days: number }[] = [
  { label: '+1 wk', days: 7 },
  { label: '+1 mo', days: 30 },
  { label: '+3 mo', days: 90 },
  { label: '+1 yr', days: 365 },
];

export const ReceiveStockForm: React.FC<ReceiveStockFormProps> = ({
  ingredients,
  batches,
  costRequired = false,
  receivedBy,
  prefill,
  onSubmit,
  onSubmitted,
  onCreateIngredient,
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

  // In-place ingredient creation state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngCategory, setNewIngCategory] = useState('Dairy');
  const [newIngUnit, setNewIngUnit] = useState('L');
  const [newIngReorder, setNewIngReorder] = useState('5');
  const [newIngLifespan, setNewIngLifespan] = useState('7');
  const [newIngCost, setNewIngCost] = useState('');
  const [creatingIng, setCreatingIng] = useState(false);
  const [newIngError, setNewIngError] = useState('');

  const handleCategorySelect = (cat: string) => {
    setNewIngCategory(cat);
    const defaultDays = CATEGORY_LIFESPAN_DAYS[cat] ?? 30;
    setNewIngLifespan(String(defaultDays));
    if (cat === 'Packaging') setNewIngUnit('pcs');
    else if (cat === 'Coffee Beans') setNewIngUnit('kg');
    else if (cat === 'Dairy') setNewIngUnit('L');
    else if (cat === 'Beverages') setNewIngUnit('pcs');
  };

  const handleSaveNewIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName.trim()) {
      setNewIngError('Ingredient name is required');
      return;
    }
    if (!onCreateIngredient) return;
    setCreatingIng(true);
    setNewIngError('');
    try {
      const lifespan = parseInt(newIngLifespan, 10);
      const created = await onCreateIngredient({
        name: newIngName.trim(),
        category: newIngCategory,
        unit: newIngUnit,
        reorder_point: parseFloat(newIngReorder) || 5.0,
        cost_per_unit: parseFloat(newIngCost) || 0.0,
        lifespan_days: isNaN(lifespan) ? (CATEGORY_LIFESPAN_DAYS[newIngCategory] ?? 30) : lifespan,
        stock_level: 0.0,
      });
      setCreatingIng(false);
      if (created) {
        setShowNewModal(false);
        setNewIngName('');
        setNewIngCost('');
        // Automatically select the newly created ingredient and auto-calculate its expiry date!
        handleIngredientChange(String(created.id));
      }
    } catch (err: any) {
      setCreatingIng(false);
      setNewIngError(err?.message || 'Failed to create ingredient');
    }
  };

  useEffect(() => {
    if (!prefill) return;
    setIngredientId(String(prefill.ingredientId));
    const target = ingredients.find((i) => i.id === prefill.ingredientId);
    const autoExpiry = target ? addDaysInput(getCalculatedLifespan(target)) : '';
    setRows([newRow(String(prefill.quantity), autoExpiry)]);
    setCost(prefill.cost ?? '');
    setSupplier(prefill.supplier ?? '');
    setInvoiceNumber(prefill.invoiceNumber ?? '');
    setActivePrefill(prefill);
    setTriedSubmit(false);
    setKeptDelivery(false);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => firstExpiryRef.current?.focus(), 350);
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
    const usableTotal = mine.length > 0
      ? mine.filter((b) => b.expiry_status !== 'expired').reduce((s, b) => s + (b.quantity_remaining || 0), 0)
      : (selected.stock_level || 0);
    return { count: mine.length, next, expired, usableTotal };
  }, [selected, batches]);

  const totalQty = rows.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);

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

  const handleIngredientChange = (newId: string) => {
    setIngredientId(newId);
    const target = ingredients.find((i) => i.id === Number(newId));
    if (target) {
      const lifespan = getCalculatedLifespan(target);
      const autoExpiry = addDaysInput(lifespan);
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          expiry: autoExpiry,
        }))
      );
    }
  };

  const resetAfterSave = () => {
    setIngredientId('');
    setRows([newRow()]);
    setCost('');
    setActivePrefill(null);
    setTriedSubmit(false);
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
          <Archive size={20} color="#C89D66" />
          <h3 style={styles.cardTitle}>Stock In</h3>
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              id="rs-ingredient"
              className="glass-input"
              value={ingredientId}
              onChange={(e) => {
                if (e.target.value === '__NEW_INGREDIENT__') {
                  setShowNewModal(true);
                  return;
                }
                handleIngredientChange(e.target.value);
              }}
              style={{ flex: 1 }}
            >
              <option value="" disabled>Choose what arrived…</option>
              {onCreateIngredient && (
                <option value="__NEW_INGREDIENT__" style={{ fontWeight: 700, color: '#C89D66' }}>
                  ✨ + Create / Register New Ingredient…
                </option>
              )}
              {groupedIngredients.map(([category, list]) => (
                <optgroup key={category} label={category}>
                  {list.map((ing) => {
                    const ingBatches = batches.filter((b) => b.ingredient_id === ing.id && b.state === 'active');
                    const usable = ingBatches.length > 0
                      ? ingBatches.filter((b) => b.expiry_status !== 'expired').reduce((s, b) => s + (b.quantity_remaining || 0), 0)
                      : ing.stock_level;
                    return (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} · {formatQty(usable)} {ing.unit} on hand
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>

            {onCreateIngredient && (
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                style={styles.newItemBtn}
                title="Register a new ingredient specification"
              >
                <Plus size={14} color="#C89D66" />
                <span>+ New Item</span>
              </button>
            )}
          </div>
          {show(!ingredientId ? 'Choose an ingredient' : undefined)}

          {selected && onHand && (
            <div style={styles.onHand}>
              <Layers size={13} style={{ flexShrink: 0, marginTop: 2, color: '#C89D66' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>
                  <strong style={{ color: '#FFFFFF' }}>{formatQty(onHand.usableTotal)} {unit}</strong> on hand in {onHand.count - onHand.expired.length}{' '}
                  {onHand.count - onHand.expired.length === 1 ? 'batch' : 'batches'}
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
                  <span style={{ color: '#FF4D4D', fontWeight: 700 }}>
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

                <div style={styles.batchFieldsGrid}>
                  <div style={styles.inputGroup}>
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

                  <div style={styles.inputGroup}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <label style={styles.subLabel}>Batch / Lot ID</label>
                      <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>[Code]-[YYYYMMDD]-[##]</span>
                    </div>
                    <div style={styles.inputWithPrefix}>
                      <Hash size={13} style={styles.prefixIcon} />
                      <input
                        type="text"
                        placeholder={selected ? `Auto: ${selected.name.match(/[A-Za-z0-9]+/g)?.slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'LOT'}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(idx + 1).padStart(2, '0')}` : 'Auto (e.g. WM-20261012-01)'}
                        className="glass-input"
                        value={row.batchCode}
                        maxLength={60}
                        onChange={(e) => updateRow(row.uid, { batchCode: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '28px', fontFamily: 'ui-monospace, monospace' }}
                      />
                    </div>
                    {dupe && <span style={styles.fieldError}>Same ID used twice in this delivery</span>}
                  </div>

                  <div style={styles.inputGroup}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <label style={styles.subLabel}>Expiry date</label>
                      {selected && (
                        <span style={{ fontSize: '0.7rem', color: '#C89D66', fontWeight: 600 }}>
                          ✨ Auto ({getCalculatedLifespan(selected)}d)
                        </span>
                      )}
                    </div>
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
                          borderColor: triedSubmit && errs.expiry ? '#FF4D4D' : undefined,
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                      {selected ? (
                        <button
                          type="button"
                          style={{
                            ...styles.chip,
                            ...styles.chipSuggested,
                            background: row.expiry === addDaysInput(getCalculatedLifespan(selected)) ? 'rgba(200, 157, 102, 0.2)' : 'rgba(200, 157, 102, 0.08)',
                          }}
                          onClick={() => updateRow(row.uid, { expiry: addDaysInput(getCalculatedLifespan(selected)) })}
                          title={`Reset to default shelf life for ${selected.name}`}
                        >
                          ⚡ Default · {getCalculatedLifespan(selected)}d
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                        <span style={{ ...styles.expiryHint, color: days !== null && days < 0 ? '#FF4D4D' : tone.color }}>
                          {expiryLabel(days)} · {formatExpiry(row.expiry)}
                        </span>
                        {selected && (
                          <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                            {row.expiry === addDaysInput(getCalculatedLifespan(selected))
                              ? `✨ Pre-filled: [Today + ${getCalculatedLifespan(selected)} days]`
                              : `✏️ Manually overridden`}
                          </span>
                        )}
                      </div>
                    ) : (
                      show(errs.expiry) || (
                        <span style={styles.hint}>Auto-fills based on item shelf life.</span>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            style={styles.addBatchBtn}
            onClick={() => {
              const autoExpiry = selected ? addDaysInput(getCalculatedLifespan(selected)) : '';
              setRows((prev) => [...prev, newRow('', autoExpiry)]);
            }}
          >
            <Plus size={14} color="#C89D66" />
            <span>Add another batch</span>
          </button>
        </div>

        {/* Delivery Details: Clean 3-column responsive grid */}
        <div style={styles.deliveryGrid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              Total cost (₱){costRequired ? '' : ' · optional'}
            </label>
            <div style={styles.inputWithPrefix}>
              <span style={{ ...styles.prefixIcon, fontSize: '14px', fontWeight: 700, color: '#C89D66' }}>₱</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="e.g. 6000.00"
                className="glass-input"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '28px' }}
              />
            </div>
            {show(costRequired && !(parseFloat(cost) > 0) ? 'Total cost is required' : undefined)}
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Supplier</label>
            <input
              type="text"
              placeholder="e.g. Valley View Farms"
              className="glass-input"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
            {show(!supplier.trim() ? 'Supplier is required' : undefined)}
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
                Kept supplier and invoice for next item.{' '}
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

        <div style={styles.summaryRow}>
          <div style={styles.summaryText}>
            {totalQty > 0 ? (
              <>
                Stocking in <strong style={{ color: '#FFFFFF' }}>{formatQty(totalQty)} {unit}</strong> in {rows.length}{' '}
                {rows.length === 1 ? 'batch' : 'batches'}
                {selected && (
                  <> · stock {formatQty(selected.stock_level)} → <strong style={{ color: '#FFFFFF' }}>{formatQty(selected.stock_level + totalQty)} {unit}</strong></>
                )}
              </>
            ) : (
              'Enter the quantity for each batch above'
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={styles.submitBtn}
            disabled={saving}
          >
            <Plus size={16} />
            <span>{saving ? 'Saving…' : rows.length > 1 ? `Stock In ${rows.length} Batches` : 'Stock In Batch'}</span>
          </button>
        </div>
      </form>

      {/* Lightweight in-place modal: Add Ingredient Spec */}
      {showNewModal && (
        <div style={styles.modalOverlay} onClick={() => !creatingIng && setShowNewModal(false)}>
          <div
            style={styles.modalCard}
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Archive size={20} color="#C89D66" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Add Ingredient Spec
                </h3>
              </div>
              <button
                type="button"
                style={styles.iconBtn}
                onClick={() => setShowNewModal(false)}
                disabled={creatingIng}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.45 }}>
              Register a new ingredient specification into the catalog. Once saved, it will be automatically selected so you can log its incoming stock batch immediately.
            </p>

            <form onSubmit={handleSaveNewIngredient} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Ingredient Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Vanilla Bean Syrup"
                  className="glass-input"
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Category</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ALL_CATEGORIES.map((cat) => {
                    const active = newIngCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategorySelect(cat)}
                        style={{
                          ...styles.chip,
                          ...(active ? { background: 'rgba(200, 157, 102, 0.2)', borderColor: '#C89D66', color: '#C89D66', fontWeight: 700 } : {}),
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.inputRow}>
                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Measurement Unit</label>
                  <select
                    className="glass-input"
                    value={newIngUnit}
                    onChange={(e) => setNewIngUnit(e.target.value)}
                  >
                    {ALL_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Shelf Life (Days)</label>
                  <input
                    type="number"
                    min="1"
                    className="glass-input"
                    value={newIngLifespan}
                    onChange={(e) => setNewIngLifespan(e.target.value)}
                  />
                </div>
              </div>

              <div style={styles.inputRow}>
                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Reorder Point</label>
                  <input
                    type="number"
                    step="any"
                    className="glass-input"
                    placeholder="e.g. 5"
                    value={newIngReorder}
                    onChange={(e) => setNewIngReorder(e.target.value)}
                  />
                </div>

                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Default Cost per Unit (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="glass-input"
                    placeholder="0.00"
                    value={newIngCost}
                    onChange={(e) => setNewIngCost(e.target.value)}
                  />
                </div>
              </div>

              {newIngError && (
                <div style={{ color: '#FF4D4D', fontSize: '0.75rem', fontWeight: 600 }}>
                  {newIngError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowNewModal(false)}
                  disabled={creatingIng}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#C89D66', borderColor: '#C89D66', color: '#FFFFFF' }}
                  disabled={creatingIng}
                >
                  {creatingIng ? 'Saving…' : 'Save & Select'}
                </button>
              </div>
            </form>
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
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '16px',
    marginBottom: '20px',
  },
  headerTitleGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  cardTitle: { margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em' },
  headerDesc: { fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.45 },
  formBody: { display: 'flex', flexDirection: 'column' as const, gap: '18px', scrollMarginTop: '24px', width: '100%' },
  inputGroup: { display: 'flex', flexDirection: 'column' as const, gap: '6px', minWidth: 0 },
  inputRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' as const },
  batchFieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
    alignItems: 'start',
    width: '100%',
  },
  deliveryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    width: '100%',
  },
  label: { fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 },
  subLabel: { fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  hint: { fontSize: '0.72rem', color: '#94A3B8' },
  fieldError: { fontSize: '0.72rem', color: '#FF4D4D', fontWeight: 600 },
  expiryHint: { fontSize: '0.75rem', fontWeight: 700 },
  inputWithSuffix: { position: 'relative' as const, display: 'flex', alignItems: 'center' },
  suffixText: { position: 'absolute' as const, right: '12px', fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 },
  inputWithPrefix: { position: 'relative' as const, display: 'flex', alignItems: 'center' },
  prefixIcon: { position: 'absolute' as const, left: '10px', color: '#94A3B8', pointerEvents: 'none' as const },
  onHand: {
    display: 'flex',
    gap: '8px',
    fontSize: '0.76rem',
    color: '#94A3B8',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '10px 12px',
    lineHeight: 1.45,
  },
  code: { fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem', fontWeight: 700, color: '#FFFFFF' },
  batchRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    padding: '16px 20px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(18, 18, 22, 0.65)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  batchRowHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  batchIndex: { fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF' },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94A3B8',
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
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'transparent',
    color: '#94A3B8',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  chipSuggested: {
    color: '#C89D66',
    borderColor: 'rgba(200, 157, 102, 0.4)',
    background: 'rgba(200, 157, 102, 0.08)',
  },
  notice: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.76rem',
    color: '#FFFFFF',
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
    color: '#C89D66',
    fontWeight: 700,
    fontSize: '0.75rem',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap' as const,
    borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
    paddingTop: '16px',
    marginTop: '4px',
  },
  summaryText: {
    fontSize: '0.85rem',
    color: '#94A3B8',
    flex: '1 1 280px',
  },
  newItemBtn: {
    background: 'rgba(200, 157, 102, 0.16)',
    border: '1px solid rgba(200, 157, 102, 0.4)',
    color: '#C89D66',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '8px 14px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  addBatchBtn: {
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 600,
    padding: '10px 14px',
    color: '#C89D66',
    border: '1px solid rgba(200, 157, 102, 0.35)',
    background: 'rgba(200, 157, 102, 0.08)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  submitBtn: {
    justifyContent: 'center',
    background: '#C89D66',
    border: '1px solid #C89D66',
    color: '#FFFFFF',
    fontWeight: 700,
    padding: '12px 24px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(200, 157, 102, 0.25)',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
    padding: '16px',
    backdropFilter: 'blur(5px)',
  },
  modalCard: {
    width: '100%',
    maxWidth: '460px',
    background: '#121212',
    color: '#FFFFFF',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
    textAlign: 'left' as const,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
};
