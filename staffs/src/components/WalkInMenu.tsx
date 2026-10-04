import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Coffee, Check, AlertTriangle, Info, RefreshCw, X } from 'lucide-react';
import type { Ingredient } from '../types';

const SALE_LEVELS = ['Less', 'Regular', 'Extra'] as const;

interface WalkInMenuProps {
  menuItems: any[];
  ingredients: Ingredient[];
  onRecordSale: (
    menuItemId: number,
    quantity: number,
    serveImmediately: boolean,
    size: string | null,
    customizations: { ingredient_id: number; name: string; level: string }[]
  ) => void;
  onRequestIngredient: (ingredientId: number, quantity: number, notes: string) => void;
  loading: boolean;
  onRefresh: () => void;
}

export const WalkInMenu: React.FC<WalkInMenuProps> = ({
  menuItems,
  ingredients,
  onRecordSale,
  onRequestIngredient,
  loading,
  onRefresh,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [saleSize, setSaleSize] = useState<string | null>(null);
  const [saleLevels, setSaleLevels] = useState<Record<number, string>>({});
  const [quantitySold, setQuantitySold] = useState<number>(1);
  const [serveImmediately, setServeImmediately] = useState<boolean>(true);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const initializedForIdRef = useRef<number | ''>('');

  // Ingredient Request Modal State
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestingIngredientId, setRequestingIngredientId] = useState<number | ''>('');
  const [requestQuantity, setRequestQuantity] = useState<number>(1);
  const [requestNotes, setRequestNotes] = useState<string>('');

  const titleCase = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : '';

  const formatAmount = (qty: number, unit: string) => {
    if (!Number.isFinite(qty) || qty <= 0) return `0 ${unit}`;
    const u = (unit || '').toLowerCase().trim();
    if (u === 'kg') {
      const grams = qty * 1000;
      if (grams < 1 && grams > 0) return `${grams.toFixed(2)} g`;
      return `${Math.round(grams)} g`;
    }
    if (u === 'l') {
      const ml = qty * 1000;
      if (ml < 1 && ml > 0) return `${ml.toFixed(2)} ml`;
      return `${Math.round(ml)} ml`;
    }
    if (u === 'mg') return `${qty} mg`;
    if (u === 'g') return `${qty} g`;
    if (u === 'ml') return `${qty} ml`;
    const formatted = qty < 10 ? (Number.isInteger(qty) ? qty.toString() : qty.toFixed(2)) : Math.round(qty).toString();
    return `${formatted} ${unit}`;
  };

  const categories = Array.from(
    new Set(menuItems.map((item) => String(item.category || '').toLowerCase()).filter(Boolean))
  );

  const visibleProducts = menuItems.filter((item) => {
    if (categoryFilter === 'all') return true;
    return String(item.category || '').toLowerCase() === categoryFilter.toLowerCase();
  });

  const selectedItem = menuItems.find((item) => item.id === Number(selectedProductId)) || null;

  const offeredSizes = selectedItem?.offered_sizes && Array.isArray(selectedItem.offered_sizes)
    ? selectedItem.offered_sizes
    : [];

  useEffect(() => {
    if (selectedProductId === '') {
      initializedForIdRef.current = '';
      setSaleSize(null);
      setSaleLevels({});
      return;
    }

    if (!selectedItem) return;

    // Only reset size and levels when switching to a different product
    if (initializedForIdRef.current !== selectedProductId) {
      initializedForIdRef.current = selectedProductId;

      const sizes = selectedItem.offered_sizes && Array.isArray(selectedItem.offered_sizes)
        ? selectedItem.offered_sizes
        : [];
      const initialSize = sizes.includes('Regular') ? 'Regular' : sizes.length > 0 ? sizes[0] : null;
      setSaleSize(initialSize);

      const recipe = selectedItem.ingredients || [];
      const customizable = recipe.filter((i: any) => i.is_customizable);
      const initialLevels: Record<number, string> = {};
      customizable.forEach((i: any) => {
        initialLevels[i.ingredient_id] = 'Regular';
      });
      setSaleLevels(initialLevels);
    }
  }, [selectedProductId, selectedItem]);

  const selectProduct = (id: number) => {
    if (selectedProductId === id) return;
    setSelectedProductId(id);
    setQuantitySold(1);
  };

  const getItemPrice = (item: any, size: string | null): number => {
    if (!item) return 0;
    if (size === 'Small' && item.price_small != null) return parseFloat(item.price_small);
    if (size === 'Large' && item.price_large != null) return parseFloat(item.price_large);
    if ((size === 'Regular' || size === 'Medium') && item.price_medium != null) return parseFloat(item.price_medium);
    return parseFloat(item.price || '0');
  };

  const recipeQty = (ingredientConfig: any, size: string | null): number => {
    if (!ingredientConfig) return 0;
    const base = parseFloat(
      ingredientConfig.default_quantity ?? ingredientConfig.quantity ?? '0'
    );
    if (size === 'Small') {
      return ingredientConfig.qty_small != null
        ? parseFloat(ingredientConfig.qty_small)
        : ingredientConfig.quantity_small != null
        ? parseFloat(ingredientConfig.quantity_small)
        : base * 0.75;
    }
    if (size === 'Large') {
      return ingredientConfig.qty_large != null
        ? parseFloat(ingredientConfig.qty_large)
        : ingredientConfig.quantity_large != null
        ? parseFloat(ingredientConfig.quantity_large)
        : base * 1.25;
    }
    if (size === 'Regular' || size === 'Medium') {
      return ingredientConfig.qty_medium != null
        ? parseFloat(ingredientConfig.qty_medium)
        : ingredientConfig.quantity_medium != null
        ? parseFloat(ingredientConfig.quantity_medium)
        : base;
    }
    return base;
  };

  const customizableIngredients = (selectedItem?.ingredients || []).filter((i: any) => i.is_customizable);

  // Ingredient Impact calculation
  const getIngredientImpacts = () => {
    if (selectedProductId === '') return { impacts: [], isInsufficient: false };

    const recipe = selectedItem?.ingredients || [];
    let isInsufficient = false;

    const impacts = recipe.map((req: any) => {
      const dbIng = ingredients.find(i => i.id === req.ingredient_id);
      const level = saleLevels[req.ingredient_id] ?? 'Regular';
      const multiplier = level === 'Less' ? 0.5 : level === 'Extra' ? 1.5 : 1;
      const basePerCup = recipeQty(req, saleSize);
      const totalNeeded = basePerCup * multiplier * quantitySold;

      const currentStock = dbIng ? dbIng.stock_level : 0;
      const projectedStock = currentStock - totalNeeded;
      const insufficient = projectedStock < 0;

      if (insufficient) isInsufficient = true;

      return {
        ingId: req.ingredient_id,
        name: req.name || dbIng?.name || `Ingredient #${req.ingredient_id}`,
        unit: req.unit || dbIng?.unit || 'units',
        totalNeeded,
        currentStock,
        projectedStock,
        insufficient
      };
    });

    return { impacts, isInsufficient };
  };

  const { impacts, isInsufficient } = getIngredientImpacts();

  const handleRecordSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || isInsufficient) return;

    const customizations = Object.entries(saleLevels).map(([ingId, level]) => {
      const ingConfig = (selectedItem?.ingredients || []).find((i: any) => i.ingredient_id === Number(ingId));
      return {
        ingredient_id: Number(ingId),
        name: ingConfig?.name || `Ingredient #${ingId}`,
        level
      };
    });

    onRecordSale(
      Number(selectedProductId),
      quantitySold,
      serveImmediately,
      saleSize,
      customizations
    );

    // Reset selection after sale
    setSelectedProductId('');
    setQuantitySold(1);
  };

  const productImageSrc = (item: any) => {
    if (!item) return '/break_and_brews.png';
    if (imageErrors[item.id]) return '/break_and_brews.png';
    return item.image_url || '/break_and_brews.png';
  };

  const openRequestModal = (ingredientId?: number) => {
    if (ingredientId) {
      setRequestingIngredientId(ingredientId);
    } else if (ingredients.length > 0) {
      setRequestingIngredientId(ingredients[0].id);
    }
    setRequestQuantity(1);
    setRequestNotes('');
    setRequestModalOpen(true);
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestingIngredientId) {
      onRequestIngredient(Number(requestingIngredientId), requestQuantity, requestNotes);
      setRequestModalOpen(false);
    }
  };

  return (
    <div style={styles.container} className="fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>MENU & WALK-IN ORDER</h2>
          <p style={styles.subtitle}>RING UP POS SALES AND CHECK REAL-TIME INGREDIENT DEDUCTIONS</p>
        </div>
        <button 
          onClick={onRefresh} 
          className="btn btn-secondary" 
          disabled={loading}
          style={styles.refreshBtn}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh Menu</span>
        </button>
      </div>

      {/* POS Layout */}
      <div className="walkin-layout">
        {/* Menu Catalog */}
        <div className="glass-card walkin-catalog">
          <div className="walkin-catalog__head">
            <div>
              <h3 className="walkin-catalog__title">Product Catalog</h3>
              <p className="walkin-catalog__hint">Tap any product to select and ring up on the sale ticket.</p>
            </div>
            <div className="walkin-chips">
              <button
                type="button"
                className={`walkin-chip${categoryFilter === 'all' ? ' is-active' : ''}`}
                onClick={() => setCategoryFilter('all')}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={`walkin-chip${categoryFilter.toLowerCase() === String(category).toLowerCase() ? ' is-active' : ''}`}
                  onClick={() => setCategoryFilter(String(category).toLowerCase())}
                >
                  {titleCase(String(category))}
                </button>
              ))}
            </div>
          </div>

          {visibleProducts.length === 0 ? (
            <div style={styles.emptyState}>
              <Coffee size={32} color="var(--text-muted)" />
              <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                No products found in this category.
              </p>
            </div>
          ) : (
            <div className="walkin-grid">
              {visibleProducts.map((item) => {
                const selected = selectedProductId === item.id;
                const paused = Boolean(item.stock_paused);
                const unavailable = !item.is_available || paused;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`walkin-card${selected ? ' is-selected' : ''}${unavailable ? ' is-unavailable' : ''}`}
                    disabled={unavailable}
                    onClick={() => selectProduct(item.id)}
                  >
                    <div className="walkin-card__media">
                      <img
                        src={productImageSrc(item)}
                        alt={item.name}
                        onError={() =>
                          setImageErrors((current) => ({ ...current, [item.id]: true }))
                        }
                      />
                      <span className="walkin-card__badge">{titleCase(String(item.category))}</span>
                      {selected && (
                        <span className="walkin-card__check">
                          <Check size={14} />
                        </span>
                      )}
                      {unavailable && (
                        <span
                          className="walkin-card__sold"
                          title={paused ? `Low stock: ${(item.paused_ingredients || []).join(', ')}` : undefined}
                        >
                          {paused ? 'Unavailable at the moment' : 'Unavailable'}
                        </span>
                      )}
                    </div>
                    <div className="walkin-card__body">
                      <h4 className="walkin-card__name">{item.name}</h4>
                      <span className="walkin-card__price">
                        ₱{getItemPrice(item, 'Regular').toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* POS Sale Ticket Panel */}
        <div className="glass-card walkin-ticket">
          <div style={styles.formTitleContainer}>
            <div style={styles.iconCircle}>
              <ShoppingBag size={20} color="var(--primary-brown)" />
            </div>
            <h3 style={styles.formTitle}>Sale Ticket</h3>
          </div>

          {selectedItem ? (
            <div className="walkin-selected">
              <img
                src={productImageSrc(selectedItem)}
                alt={selectedItem.name}
                onError={() =>
                  setImageErrors((current) => ({ ...current, [selectedItem.id]: true }))
                }
              />
              <div>
                <h4 className="walkin-selected__name">{selectedItem.name}</h4>
                <p className="walkin-selected__meta">
                  {titleCase(String(selectedItem.category))} · ₱{(getItemPrice(selectedItem, saleSize) * quantitySold).toFixed(2)}{' '}
                  {saleSize
                    ? `(${saleSize}${quantitySold > 1 ? ` × ${quantitySold}` : ''})`
                    : quantitySold > 1
                    ? `(× ${quantitySold})`
                    : ''}
                </p>
              </div>
            </div>
          ) : (
            <div className="walkin-selected">
              <div className="walkin-selected__fallback">
                <Coffee size={22} />
              </div>
              <div>
                <h4 className="walkin-selected__name">No product selected</h4>
                <p className="walkin-selected__meta">Choose an item from the menu to continue.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleRecordSaleSubmit} style={styles.form}>
            {selectedItem && offeredSizes.length > 0 && (
              <div className="walkin-option">
                <span className="walkin-option__label">Size</span>
                <div className="walkin-chips" role="radiogroup" aria-label="Size">
                  {offeredSizes.map((size: string) => (
                    <button
                      key={size}
                      type="button"
                      role="radio"
                      aria-checked={saleSize === size}
                      className={`walkin-chip${saleSize === size ? ' is-active' : ''}`}
                      onClick={() => setSaleSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedItem && customizableIngredients.length > 0 && (
              <div className="walkin-option">
                <span className="walkin-option__label">Make it yours</span>
                {customizableIngredients.map((ingredient: any) => {
                  const current = saleLevels[ingredient.ingredient_id] ?? 'Regular';
                  return (
                    <div key={ingredient.ingredient_id} className="walkin-option">
                      <span className="walkin-option__label">{ingredient.name}</span>
                      <div className="walkin-chips" role="radiogroup" aria-label={ingredient.name}>
                        {SALE_LEVELS.map((level) => {
                          const multiplier = level === 'Less' ? 0.5 : level === 'Extra' ? 1.5 : 1;
                          const amount = formatAmount(
                            recipeQty(ingredient, saleSize) * multiplier,
                            ingredient.unit
                          );
                          return (
                            <button
                              key={level}
                              type="button"
                              role="radio"
                              aria-checked={current === level}
                              className={`walkin-chip walkin-chip--stack${current === level ? ' is-active' : ''}`}
                              onClick={() =>
                                setSaleLevels((prev) => ({ ...prev, [ingredient.ingredient_id]: level }))
                              }
                            >
                              <span>{level}</span>
                              <small>{amount}</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Quantity</label>
              <input 
                type="number" 
                min="1" 
                max="50"
                value={quantitySold} 
                onChange={(e) => setQuantitySold(Math.max(1, parseInt(e.target.value) || 1))}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.checkboxContainer}>
              <label style={styles.checkboxLabel}>
                <input 
                  type="checkbox" 
                  checked={serveImmediately}
                  onChange={(e) => setServeImmediately(e.target.checked)}
                  style={styles.checkbox}
                />
                Serve immediately (Skip Queue)
              </label>
            </div>

            <div style={{ ...styles.formTitleContainer, marginTop: '8px', marginBottom: '12px' }}>
              <div style={styles.iconCircle}>
                <Info size={20} color="var(--primary-brown)" />
              </div>
              <h3 style={styles.formTitle}>Ingredient Impact</h3>
            </div>

            {selectedProductId === '' ? (
              <div style={{ ...styles.impactPlaceholder, minHeight: '140px' }}>
                <p style={styles.placeholderText}>
                  Select a product to view ingredient details
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={styles.impactList}>
                  {impacts.map((imp: any) => (
                    <div key={imp.ingId} style={styles.impactRow}>
                      <div>
                        <p style={styles.impactIngName}>{imp.name}</p>
                        <p style={styles.impactDetail}>
                          Need: {formatAmount(imp.totalNeeded, imp.unit)} | Stock: {formatAmount(imp.currentStock, imp.unit)} ({imp.currentStock.toFixed(2)} {imp.unit})
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          ...styles.impactBadge,
                          color: imp.insufficient ? '#ef4444' : '#10b981',
                          backgroundColor: imp.insufficient ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'
                        }}>
                          {imp.insufficient ? 'Shortage' : `-> ${imp.projectedStock.toFixed(2)} ${imp.unit}`}
                        </span>
                        {imp.insufficient && (
                          <button
                            type="button"
                            onClick={() => openRequestModal(imp.ingId)}
                            style={styles.requestBtnInline}
                          >
                            + Request Refill
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isInsufficient ? (
                  <div style={styles.errorBanner}>
                    <AlertTriangle size={18} />
                    <span>Insufficient stock! Restock or adjust quantity.</span>
                  </div>
                ) : (
                  <div style={styles.successBanner}>
                    <Check size={18} />
                    <span>Inventory levels are sufficient.</span>
                  </div>
                )}
              </div>
            )}

            <button 
              type="submit" 
              className="btn" 
              style={{
                ...styles.btnRecord,
                opacity: selectedProductId === '' || isInsufficient ? 0.6 : 1,
                cursor: selectedProductId === '' || isInsufficient ? 'not-allowed' : 'pointer'
              }}
              disabled={selectedProductId === '' || isInsufficient}
            >
              {selectedItem ? `Order · ₱${(getItemPrice(selectedItem, saleSize) * quantitySold).toFixed(2)}` : 'Order'}
            </button>
          </form>
        </div>
      </div>

      {/* REQUEST INGREDIENT MODAL */}
      {requestModalOpen && (
        <div className="modal-overlay" style={styles.modalOverlay}>
          <div className="modal-content" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Request Ingredients</h3>
              <button onClick={() => setRequestModalOpen(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRequestSubmit} style={{ padding: '24px' }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Select Ingredient</label>
                <select
                  value={requestingIngredientId}
                  onChange={(e) => setRequestingIngredientId(Number(e.target.value))}
                  style={styles.select}
                  required
                >
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (Current Stock: {ing.stock_level} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Quantity Needed</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes / Reason (Optional)</label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="e.g. Low stock during morning rush"
                  style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: '10px 20px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', backgroundColor: 'var(--accent-primary)', color: '#fff' }}
                >
                  Send Request
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
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '1px',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  refreshBtn: {
    height: '42px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  formTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  iconCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(148, 118, 86, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border-glass)',
    backgroundColor: 'var(--bg-primary)',
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  select: {
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border-glass)',
    backgroundColor: 'var(--bg-primary)',
    fontSize: '0.95rem',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  checkboxContainer: {
    margin: '4px 0',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  impactPlaceholder: {
    padding: '20px',
    backgroundColor: 'rgba(148, 118, 86, 0.05)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px dashed var(--border-glass)',
  },
  placeholderText: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  impactList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '12px',
  },
  impactRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: '10px',
    border: '1px solid var(--border-glass)',
  },
  impactIngName: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  impactDetail: {
    margin: '2px 0 0 0',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  impactBadge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '4px 8px',
    borderRadius: '6px',
    display: 'inline-block',
  },
  requestBtnInline: {
    display: 'block',
    marginTop: '4px',
    fontSize: '0.7rem',
    color: 'var(--accent-primary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '700',
    textDecoration: 'underline',
  },
  errorBanner: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    color: '#ef4444',
    fontSize: '0.85rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  successBanner: {
    padding: '12px 16px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '10px',
    color: '#10b981',
    fontSize: '0.85rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  btnRecord: {
    width: '100%',
    padding: '14px',
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '800',
    fontSize: '1rem',
    letterSpacing: '0.5px',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modalContent: {
    width: '100%',
    maxWidth: '500px',
    backgroundColor: '#fff',
    borderRadius: '20px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '20px 24px',
    backgroundColor: 'var(--accent-primary)',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: '700',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
};
