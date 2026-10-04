import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Eye, EyeOff, Filter, Coffee, ImagePlus } from 'lucide-react';
import type { MenuItem, Ingredient } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const SIZE_CHOICES = ['Small', 'Regular', 'Large'] as const;
type SizeChoice = (typeof SIZE_CHOICES)[number];

function isSizeableCategory(category: string): boolean {
  const c = category.toLowerCase().trim();
  if (/alcohol|beer|wine|can/.test(c)) return false;
  return (
    c === 'coffee' ||
    c === 'coffees' ||
    c === 'iced coffee' ||
    c === 'iced coffees' ||
    c.includes('platter') ||
    c.includes('rice bowl') ||
    c.includes('rice meal')
  );
}

function isAutoCustomizable(ing: Ingredient): boolean {
  if (ing.category === 'Packaging') return false;
  return ['kg', 'mg', 'L', 'ml', 'g'].includes(ing.unit);
}

function roundQty(qty: number): number {
  return Math.round(qty * 1000) / 1000;
}

function toFriendlyQty(qty: number, unit: string): number {
  if (unit === 'kg' || unit === 'L') return roundQty(qty * 1000);
  return roundQty(qty);
}

function fromFriendlyQty(qty: number, unit: string): number {
  if (unit === 'kg' || unit === 'L') return qty / 1000;
  return qty;
}

function friendlyUnitLabel(unit: string): string {
  if (unit === 'kg') return 'g';
  if (unit === 'L') return 'ml';
  return unit;
}

function formatFriendlyAmount(qty: number, unit: string): string {
  const friendly = toFriendlyQty(qty, unit);
  const label = friendlyUnitLabel(unit);
  const rounded = label === 'g' || label === 'ml' ? Math.round(friendly * 100) / 100 : friendly;
  return `${rounded}${label}`;
}

type RecipeRow = {
  ingredient_id: number;
  default_quantity: number;
  qty_small: number;
  qty_medium: number;
  qty_large: number;
  is_customizable: boolean;
};

interface ManageMenuProps {
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  onCreateMenuItem: (data: any) => void;
  onUpdateMenuItem: (id: number, data: any) => void;
  onDeleteMenuItem: (id: number) => void;
}

export const ManageMenu: React.FC<ManageMenuProps> = ({
  menuItems,
  ingredients,
  onCreateMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Coffee');
  const [price, setPrice] = useState('170.00');
  const [priceSmall, setPriceSmall] = useState('145.00');
  const [priceMedium, setPriceMedium] = useState('170.00');
  const [priceLarge, setPriceLarge] = useState('195.00');
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageNote, setImageNote] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<RecipeRow[]>([]);
  const [offeredSizes, setOfferedSizes] = useState<SizeChoice[]>([]);
  const [sizesTouched, setSizesTouched] = useState(false);
  const [newIngredientId, setNewIngredientId] = useState<number | ''>('');
  const offersSizes = offeredSizes.length > 0;

  // Categories are whatever the menu in the database actually uses — no fixed list to fall behind.
  const categories = useMemo(
    () => [...new Set(menuItems.map(item => item.category))].sort((a, b) => a.localeCompare(b)),
    [menuItems]
  );

  const startAdd = () => {
    setEditItem(null);
    setName('');
    setCategory(categories[0] ?? '');
    setPrice('170.00');
    setPriceSmall('145.00');
    setPriceMedium('170.00');
    setPriceLarge('195.00');
    setIsAvailable(true);
    setImageUrl('');
    setImageNote('');
    setSelectedIngredients([]);
    setOfferedSizes(isSizeableCategory(categories[0] ?? '') ? [...SIZE_CHOICES] : []);
    setSizesTouched(false);
    setNewIngredientId('');
    setShowModal(true);
  };

  const startEdit = (item: MenuItem) => {
    setEditItem(item);
    setName(item.name);
    setCategory(item.category);
    const baseP = item.price;
    setPrice(baseP.toString());
    setPriceSmall(item.price_small != null ? item.price_small.toString() : (baseP > 15 ? (baseP - 15).toFixed(2) : baseP.toFixed(2)));
    setPriceMedium(item.price_medium != null ? item.price_medium.toString() : baseP.toString());
    setPriceLarge(item.price_large != null ? item.price_large.toString() : (baseP + 20).toFixed(2));
    setIsAvailable(item.is_available);
    setImageUrl(item.image_url || '');
    setImageNote('');
    setSelectedIngredients(
      item.ingredients
        ? item.ingredients.map((ing) => {
            const med = ing.qty_medium ?? ing.default_quantity;
            return {
              ingredient_id: ing.ingredient_id,
              default_quantity: toFriendlyQty(ing.default_quantity, ing.unit),
              qty_small: toFriendlyQty(ing.qty_small ?? med * 0.75, ing.unit),
              qty_medium: toFriendlyQty(med, ing.unit),
              qty_large: toFriendlyQty(ing.qty_large ?? med * 1.25, ing.unit),
              is_customizable: ing.is_customizable
            };
          })
        : []
    );
    setOfferedSizes(
      Array.isArray(item.offered_sizes)
        ? SIZE_CHOICES.filter((size) => item.offered_sizes!.includes(size))
        : item.supports_sizes || isSizeableCategory(item.category)
          ? [...SIZE_CHOICES]
          : []
    );
    setSizesTouched(true);
    setNewIngredientId('');
    setShowModal(true);
  };

  const toggleOfferedSize = (size: SizeChoice) => {
    setSizesTouched(true);
    setOfferedSizes((current) =>
      current.includes(size) ? current.filter((entry) => entry !== size) : SIZE_CHOICES.filter((entry) => entry === size || current.includes(entry))
    );
  };

  const attachImage = async (file: File | undefined) => {
    if (!file) return;
    setUploadingImage(true);
    setImageNote('');
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch(`${API_URL}/uploads`, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.image_url) {
        setImageNote(data.error || 'Could not attach that image');
        return;
      }
      setImageUrl(data.image_url);
    } catch {
      setImageNote('Could not reach the server to attach the image');
    } finally {
      setUploadingImage(false);
    }
  };

  const addIngredientToRecipe = () => {
    if (newIngredientId === '') return;
    const ingId = Number(newIngredientId);
    if (selectedIngredients.some(i => i.ingredient_id === ingId)) return;

    const dbIng = ingredients.find(i => i.id === ingId);
    if (!dbIng) return;

    const baseDb = 0.1;
    const friendlyMed = toFriendlyQty(baseDb, dbIng.unit);
    setSelectedIngredients((prev) => [
      ...prev,
      {
        ingredient_id: ingId,
        default_quantity: friendlyMed,
        qty_small: roundQty(friendlyMed * 0.75),
        qty_medium: friendlyMed,
        qty_large: roundQty(friendlyMed * 1.25),
        is_customizable: isAutoCustomizable(dbIng)
      }
    ]);
    setNewIngredientId('');
  };

  const removeIngredientFromRecipe = (ingId: number) => {
    setSelectedIngredients(prev => prev.filter(i => i.ingredient_id !== ingId));
  };

  const toggleCustomizable = (ingId: number) => {
    setSelectedIngredients((prev) =>
      prev.map((row) => (row.ingredient_id === ingId ? { ...row, is_customizable: !row.is_customizable } : row))
    );
  };

  const updateRecipeIngredient = (
    ingId: number,
    field: keyof Pick<RecipeRow, 'default_quantity' | 'qty_small' | 'qty_medium' | 'qty_large'>,
    value: number
  ) => {
    setSelectedIngredients((prev) =>
      prev.map((i) => (i.ingredient_id === ingId ? { ...i, [field]: value } : i))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (offersSizes) {
      const invalidSizes: string[] = [];
      if (offeredSizes.includes('Small') && (!priceSmall || isNaN(parseFloat(priceSmall)) || parseFloat(priceSmall) <= 0)) {
        invalidSizes.push('Small');
      }
      if (offeredSizes.includes('Regular') && (!priceMedium || isNaN(parseFloat(priceMedium)) || parseFloat(priceMedium) <= 0)) {
        invalidSizes.push('Regular');
      }
      if (offeredSizes.includes('Large') && (!priceLarge || isNaN(parseFloat(priceLarge)) || parseFloat(priceLarge) <= 0)) {
        invalidSizes.push('Large');
      }
      if (invalidSizes.length > 0) {
        alert(`Please enter a valid price (> ₱0) for each active size: ${invalidSizes.join(', ')}`);
        return;
      }
    } else {
      if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
        alert('Please enter a valid retail unit price (> ₱0).');
        return;
      }
    }

    const parsedSmall = offeredSizes.includes('Small') ? parseFloat(priceSmall) : null;
    const parsedMedium = offeredSizes.includes('Regular') ? parseFloat(priceMedium) : null;
    const parsedLarge = offeredSizes.includes('Large') ? parseFloat(priceLarge) : null;
    const parsedBasePrice = offersSizes
      ? (parsedMedium ?? parsedSmall ?? parsedLarge ?? (parseFloat(price) || 0))
      : (parseFloat(price) || 0);

    const payload = {
      name,
      category,
      price: parsedBasePrice,
      price_small: parsedSmall,
      price_medium: parsedMedium,
      price_large: parsedLarge,
      is_available: isAvailable,
      image_url: imageUrl || null,
      offered_sizes: offeredSizes,
      ingredients: selectedIngredients.map((recipe) => {
        const ing = ingredients.find((i) => i.id === recipe.ingredient_id);
        if (offersSizes && ing) {
          const qtyMedium = fromFriendlyQty(recipe.qty_medium, ing.unit);
          return {
            ingredient_id: recipe.ingredient_id,
            default_quantity: qtyMedium,
            qty_small: fromFriendlyQty(recipe.qty_small, ing.unit),
            qty_medium: qtyMedium,
            qty_large: fromFriendlyQty(recipe.qty_large, ing.unit),
            is_customizable: recipe.is_customizable
          };
        }
        const qty = ing ? fromFriendlyQty(recipe.default_quantity, ing.unit) : recipe.default_quantity;
        return {
          ingredient_id: recipe.ingredient_id,
          default_quantity: qty,
          is_customizable: recipe.is_customizable
        };
      })
    };

    if (editItem) {
      onUpdateMenuItem(editItem.id, payload);
    } else {
      onCreateMenuItem(payload);
    }
    setShowModal(false);
  };

  const toggleAvailability = (item: MenuItem) => {
    onUpdateMenuItem(item.id, {
      ...item,
      is_available: !item.is_available
    });
  };

  // Filters
  const filtered = menuItems.filter((item) => {
    const matchesCategory = categoryFilter === 'all' || item.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={styles.container} className="page-scroll fade-in">
      {/* Search & Filter Header */}
      <div style={styles.header}>
        <div style={styles.searchBar}>
          <input 
            type="text" 
            placeholder="Search menu catalog..." 
            className="glass-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '260px' }}
          />

          <div style={styles.filterGroup}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="glass-input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ paddingRight: '24px' }}
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={startAdd} className="btn btn-primary">
          <Plus size={16} />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Grid of Catalog Cards */}
      <div style={styles.grid}>
        {filtered.length === 0 ? (
          <div style={styles.noResults} className="glass-card">
            <Coffee size={40} color="var(--text-muted)" />
            <span style={{ marginTop: '12px' }}>No coffee items or products found.</span>
          </div>
        ) : (
          filtered.map((item) => (
            <div 
              key={item.id} 
              style={{
                ...styles.card,
                opacity: item.is_available ? 1 : 0.7
              }} 
              className="glass-card menu-card"
            >
              {/* Product Image */}
              <div style={styles.imageWrapper}>
                {item.image_url && !imageErrors[item.id] ? (
                  <img 
                    src={item.image_url} 
                    alt={item.name} 
                    style={styles.img} 
                    onError={() => setImageErrors(prev => ({ ...prev, [item.id]: true }))}
                  />
                ) : (
                  <div style={styles.imagePlaceholder}>
                    <Coffee size={32} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
                  </div>
                )}
                <span style={styles.categoryBadge}>{item.category}</span>
              </div>

              {/* Product Info */}
              <div style={styles.cardDetails}>
                <div style={styles.row}>
                  <h4 style={styles.itemName}>{item.name}</h4>
                  <span style={styles.itemPrice}>
                    {item.offered_sizes && item.offered_sizes.length > 0 && item.price_small && item.price_large
                      ? `₱${item.price_small.toFixed(2)} – ₱${item.price_large.toFixed(2)}`
                      : `₱${item.price.toFixed(2)}`}
                  </span>
                </div>

                {item.offered_sizes && item.offered_sizes.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Sizes: {item.offered_sizes.join(', ')}
                  </div>
                )}

                {item.ingredients && item.ingredients.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-8px' }}>
                    <span style={{ fontWeight: 'bold' }}>Ingredients:</span>{' '}
                    {item.ingredients
                      .map((i) => {
                        const med = i.qty_medium ?? i.default_quantity;
                        const amt = formatFriendlyAmount(med, i.unit);
                        return `${i.name} (${amt}${i.is_customizable ? '*' : ''})`;
                      })
                      .join(', ')}
                  </div>
                )}

                <div style={styles.cardActions}>
                  <button 
                    onClick={() => toggleAvailability(item)}
                    className={item.is_available ? 'menu-btn-active' : 'menu-btn-disabled'}
                  >
                    {item.is_available ? (
                      <>
                        <Eye size={14} />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={14} />
                        <span>Disabled</span>
                      </>
                    )}
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => startEdit(item)}
                      className="menu-btn-edit" 
                      title="Edit Item"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => onDeleteMenuItem(item.id)}
                      className="menu-btn-delete" 
                      title="Delete Item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Menu Item Modal */}
      {showModal && createPortal(
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content" style={{ ...styles.modalContent, maxWidth: offersSizes ? '760px' : '560px' }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editItem ? 'Modify Menu Catalog Item' : 'Create New Menu Catalog Item'}
              </h3>
              <button onClick={() => setShowModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ ...styles.modalBody, overflowY: 'auto', maxHeight: 'calc(88vh - 70px)' }}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Product Name</label>
                <input 
                  type="text" 
                  className="glass-input"
                  placeholder="e.g. Vanilla Bean Latte"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={styles.inputRow}>
                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Category</label>
                  <input 
                    className="glass-input"
                    list="menu-category-options"
                    value={category}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCategory(next);
                      if (!sizesTouched) {
                        setOfferedSizes(isSizeableCategory(next) ? [...SIZE_CHOICES] : []);
                      }
                    }}
                    placeholder="e.g. Coffee"
                    style={{ width: '100%' }}
                    required
                  />
                  <datalist id="menu-category-options">
                    {categories.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Retail Unit Price (₱)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    className="glass-input"
                    placeholder="e.g. 170.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Product Image URL (Optional)</label>
                <input 
                  type="text" 
                  className="glass-input"
                  placeholder="e.g. /assets/espresso.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: uploadingImage ? 'wait' : 'pointer' }}>
                    <ImagePlus size={14} />
                    <span>{uploadingImage ? 'Attaching…' : 'Attach image'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      disabled={uploadingImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void attachImage(file);
                      }}
                    />
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    JPG, PNG, WEBP, or GIF, up to 5 MB. A pasted URL still works.
                  </span>
                </div>
                {imageNote && (
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#ef4444' }}>{imageNote}</p>
                )}
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Product preview"
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--border-glass)' }}
                  />
                )}
              </div>

              <div style={{ ...styles.inputGroup, borderTop: '1px solid var(--border-glass)', paddingTop: '16px', marginTop: '8px' }}>
                <label style={{ ...styles.label, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '4px' }}>
                  Sizes offered
                </label>
                <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Checked sizes appear on the customer menu and staff walk-in ticket. Each active size requires a price.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {SIZE_CHOICES.map((size) => {
                    const on = offeredSizes.includes(size);
                    const sizePrice = size === 'Small' ? priceSmall : size === 'Regular' ? priceMedium : priceLarge;
                    const setSizePrice = size === 'Small' ? setPriceSmall : size === 'Regular' ? setPriceMedium : setPriceLarge;

                    return (
                      <div
                        key={size}
                        style={{
                          background: on ? 'rgba(234, 179, 8, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          border: on ? '1.5px solid var(--accent-gold, #eab308)' : '1px solid var(--border-glass)',
                          borderRadius: '10px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleOfferedSize(size)}
                          className={on ? 'btn btn-primary' : 'btn btn-secondary'}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', fontWeight: 600 }}
                          aria-pressed={on}
                        >
                          {on ? `✓ ${size}` : `+ ${size}`}
                        </button>
                        {on && (
                          <div style={{ marginTop: '2px' }}>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', fontWeight: 500 }}>
                              {size} Price (₱) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              className="glass-input"
                              placeholder="0.00"
                              value={sizePrice}
                              onChange={(e) => setSizePrice(e.target.value)}
                              style={{ width: '100%', padding: '4px 8px', fontSize: '0.85rem', boxSizing: 'border-box', fontWeight: 600 }}
                              required={on}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recipe Ingredients Configuration Section */}
              <div style={{ ...styles.inputGroup, borderTop: '1px solid var(--border-glass)', paddingTop: '16px', marginTop: '8px' }}>
                <label style={{ ...styles.label, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '8px' }}>Recipe Ingredients</label>
                <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Turn on Make it yours for the ingredients a customer or cashier can set to Less, Regular, or Extra.
                </p>
                
                {selectedIngredients.length > 0 ? (
                  offersSizes ? (
                    <div className="table-scroll" style={{ marginBottom: '12px' }}>
                      <table className="crud-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            {offeredSizes.map((size) => (
                              <th key={size}>{size}</th>
                            ))}
                            <th>Make it yours</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedIngredients.map((recipeItem) => {
                            const ing = ingredients.find((i) => i.id === recipeItem.ingredient_id);
                            if (!ing) return null;
                            const unitLabel = friendlyUnitLabel(ing.unit);
                            const fields = offeredSizes.map((size) =>
                              size === 'Small' ? 'qty_small' : size === 'Large' ? 'qty_large' : 'qty_medium'
                            ) as ('qty_small' | 'qty_medium' | 'qty_large')[];
                            return (
                              <tr key={recipeItem.ingredient_id}>
                                <td style={{ fontWeight: 600 }}>
                                  {ing.name}
                                </td>
                                {fields.map((field) => (
                                  <td key={field}>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      className="glass-input"
                                      value={recipeItem[field]}
                                      onChange={(e) =>
                                        updateRecipeIngredient(
                                          recipeItem.ingredient_id,
                                          field,
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      style={{ width: '100%', padding: '4px 8px', boxSizing: 'border-box' }}
                                      required
                                    />
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{unitLabel}</div>
                                  </td>
                                ))}
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={recipeItem.is_customizable}
                                    onChange={() => toggleCustomizable(recipeItem.ingredient_id)}
                                    aria-label={`Offer ${ing.name} in Make it yours`}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => removeIngredientFromRecipe(recipeItem.ingredient_id)}
                                    className="menu-btn-delete"
                                    style={{ padding: '6px' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                      {selectedIngredients.map((recipeItem) => {
                        const ing = ingredients.find((i) => i.id === recipeItem.ingredient_id);
                        if (!ing) return null;
                        const unitLabel = friendlyUnitLabel(ing.unit);
                        return (
                          <div key={recipeItem.ingredient_id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ flex: 2, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {ing.name}
                            </span>
                            <div style={{ flex: 1 }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="glass-input"
                                placeholder="Qty"
                                value={recipeItem.default_quantity}
                                onChange={(e) =>
                                  updateRecipeIngredient(
                                    recipeItem.ingredient_id,
                                    'default_quantity',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                style={{ width: '100%', padding: '4px 8px', fontSize: '0.85rem', boxSizing: 'border-box' }}
                                required
                              />
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{unitLabel}</div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              <input
                                type="checkbox"
                                checked={recipeItem.is_customizable}
                                onChange={() => toggleCustomizable(recipeItem.ingredient_id)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              Make it yours
                            </label>
                            <button
                              type="button"
                              onClick={() => removeIngredientFromRecipe(recipeItem.ingredient_id)}
                              className="menu-btn-delete"
                              style={{ padding: '6px' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>No ingredients associated with this menu item recipe.</p>
                )}

                {/* Add new ingredient dropdown */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="glass-input"
                    value={newIngredientId}
                    onChange={(e) => setNewIngredientId(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }}
                  >
                    <option value="">Select ingredient to add...</option>
                    {ingredients
                      .filter(ing => !selectedIngredients.some(si => si.ingredient_id === ing.id))
                      .map(ing => (
                        <option key={ing.id} value={ing.id} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={addIngredientToRecipe}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div style={{ ...styles.inputGroup, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox"
                  id="isAvailable"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="isAvailable" style={{ ...styles.label, cursor: 'pointer', margin: 0 }}>
                  Item is actively available for sale
                </label>
              </div>

              <div style={styles.modalActions}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editItem ? 'Save Updates' : 'Add to Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    boxSizing: 'border-box' as const,
    minHeight: 0,
    flex: 1
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '16px'
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap' as const
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
    alignItems: 'start'
  },
  noResults: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    color: 'var(--text-muted)'
  },
  card: {
    padding: '0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    borderRadius: '16px',
    border: '1px solid var(--border-glass)'
  },
  imageWrapper: {
    position: 'relative' as const,
    width: '100%',
    height: '155px',
    backgroundColor: 'var(--surface-muted)',
    borderBottom: '1px solid var(--border-glass)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const
  },
  imagePlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%'
  },
  categoryBadge: {
    position: 'absolute' as const,
    top: '12px',
    left: '12px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '0.65rem',
    color: '#fbbf24',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em'
  },
  cardDetails: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    textAlign: 'left' as const
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  itemName: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  itemPrice: {
    fontSize: '1.15rem',
    fontWeight: '700',
    color: '#f59e0b'
  },
  cardActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginTop: '4px'
  },
  modalContent: {
    maxWidth: '560px'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-glass)'
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  modalBody: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    textAlign: 'left' as const
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px'
  },
  inputRow: {
    display: 'flex',
    gap: '12px'
  },
  label: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: '600'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px'
  }
};
