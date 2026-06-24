import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Eye, EyeOff, Filter, Coffee } from 'lucide-react';
import type { MenuItem } from '../types';

interface ManageMenuProps {
  menuItems: MenuItem[];
  onCreateMenuItem: (data: any) => void;
  onUpdateMenuItem: (id: number, data: any) => void;
  onDeleteMenuItem: (id: number) => void;
}

export const ManageMenu: React.FC<ManageMenuProps> = ({
  menuItems,
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
  const [price, setPrice] = useState('0.00');
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState('');

  const categories = [
    'Coffee',
    'Specialty',
    'Tea',
    'Pastries',
    'Merchandise'
  ];

  const startAdd = () => {
    setEditItem(null);
    setName('');
    setCategory('Coffee');
    setPrice('3.50');
    setIsAvailable(true);
    setImageUrl('');
    setShowModal(true);
  };

  const startEdit = (item: MenuItem) => {
    setEditItem(item);
    setName(item.name);
    setCategory(item.category);
    setPrice(item.price.toString());
    setIsAvailable(item.is_available);
    setImageUrl(item.image_url || '');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      category,
      price: parseFloat(price) || 0,
      is_available: isAvailable,
      image_url: imageUrl || null
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
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={styles.container} className="fade-in">
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
            <Filter size={16} color="#9ca3af" />
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
            <Coffee size={40} color="#4b5563" />
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
                  <span style={styles.itemPrice}>${item.price.toFixed(2)}</span>
                </div>

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
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editItem ? 'Modify Menu Catalog Item' : 'Create New Menu Catalog Item'}
              </h3>
              <button onClick={() => setShowModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={styles.modalBody}>
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
                  <select 
                    className="glass-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {categories.map(c => (
                      <option key={c} value={c} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{c}</option>
                    ))}
                  </select>
                </div>

                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Retail Unit Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="glass-input"
                    placeholder="e.g. 4.50"
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
        </div>
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
    overflowY: 'auto' as const,
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
    alignItems: 'start',
    flex: 1
  },
  noResults: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    color: '#6b7280'
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
    backgroundColor: 'rgba(255,255,255,0.01)',
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
    maxWidth: '480px'
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
    color: '#9ca3af',
    fontWeight: '600'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px'
  }
};
