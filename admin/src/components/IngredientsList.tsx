import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, Filter } from 'lucide-react';
import type { Ingredient } from '../types';

interface IngredientsListProps {
  ingredients: Ingredient[];
  onCreateIngredient: (data: any) => void;
  onUpdateIngredient: (id: number, data: any) => void;
  onDeleteIngredient: (id: number) => void;
}

export const IngredientsList: React.FC<IngredientsListProps> = ({
  ingredients,
  onCreateIngredient,
  onUpdateIngredient,
  onDeleteIngredient
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editIng, setEditIng] = useState<Ingredient | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Coffee Beans');
  const [stockLevel, setStockLevel] = useState('0');
  const [unit, setUnit] = useState('kg');
  const [reorderPoint, setReorderPoint] = useState('5');
  const [costPerUnit, setCostPerUnit] = useState('0.00');

  const categories = [
    'Coffee Beans',
    'Dairy',
    'Syrups',
    'Sweeteners',
    'Packaging',
    'Pastries'
  ];

  const startAdd = () => {
    setEditIng(null);
    setName('');
    setCategory('Coffee Beans');
    setStockLevel('0');
    setUnit('kg');
    setReorderPoint('5');
    setCostPerUnit('0.00');
    setShowModal(true);
  };

  const startEdit = (ing: Ingredient) => {
    setEditIng(ing);
    setName(ing.name);
    setCategory(ing.category);
    setStockLevel(ing.stock_level.toString());
    setUnit(ing.unit);
    setReorderPoint(ing.reorder_point.toString());
    setCostPerUnit(ing.cost_per_unit.toString());
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      category,
      stock_level: parseFloat(stockLevel) || 0,
      unit,
      reorder_point: parseFloat(reorderPoint) || 0,
      cost_per_unit: parseFloat(costPerUnit) || 0
    };

    if (editIng) {
      onUpdateIngredient(editIng.id, payload);
    } else {
      onCreateIngredient(payload);
    }
    setShowModal(false);
  };

  // Filters
  const filtered = ingredients.filter((ing) => {
    const matchesCategory = categoryFilter === 'all' || ing.category === categoryFilter;
    const matchesSearch = ing.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={styles.container} className="fade-in">
      {/* Search & Filter Header Bar */}
      <div style={styles.header}>
        <div style={styles.searchBar}>
          <input 
            type="text" 
            placeholder="Search ingredients..." 
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
          <span>Add Ingredient</span>
        </button>
      </div>

      {/* Grid of Ingredients Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="crud-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Ingredient Name</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Reorder Point</th>
              <th>Cost / Unit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                  No ingredients found matching the filter criteria.
                </td>
              </tr>
            ) : (
              filtered.map((ing) => {
                const isLowStock = ing.stock_level <= ing.reorder_point;
                const isOutOfStock = ing.stock_level === 0;

                return (
                  <tr key={ing.id}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{ing.name}</td>
                    <td>
                      <span style={styles.categoryBadge}>{ing.category}</span>
                    </td>
                    <td style={{ fontWeight: '700', color: isOutOfStock ? '#ef4444' : isLowStock ? '#f59e0b' : 'var(--text-primary)' }}>
                      {ing.stock_level} {ing.unit}
                    </td>
                    <td style={{ color: '#9ca3af' }}>
                      {ing.reorder_point} {ing.unit}
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      ${ing.cost_per_unit.toFixed(2)}
                    </td>
                    <td>
                      {isOutOfStock ? (
                        <span style={styles.statusOutOfStock}>
                          <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span style={styles.statusLowStock}>
                          <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                          Low Stock
                        </span>
                      ) : (
                        <span style={styles.statusNormal}>In Stock</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => startEdit(ing)}
                          className="btn btn-secondary" 
                          style={{ padding: '6px 10px' }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={() => onDeleteIngredient(ing.id)}
                          className="btn btn-danger" 
                          style={{ padding: '6px 10px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Ingredient Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editIng ? 'Edit Ingredient Specifications' : 'Add New Inventory Ingredient'}
              </h3>
              <button onClick={() => setShowModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={styles.modalBody}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Ingredient Name</label>
                <input 
                  type="text" 
                  className="glass-input"
                  placeholder="e.g. Arabica Beans Medium Roast"
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

                <div style={{ ...styles.inputGroup, width: '100px' }}>
                  <label style={styles.label}>Unit</label>
                  <select 
                    className="glass-input"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="kg" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>kg</option>
                    <option value="L" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>Liters (L)</option>
                    <option value="pcs" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>pieces (pcs)</option>
                    <option value="bags" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>bags</option>
                    <option value="g" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>grams (g)</option>
                  </select>
                </div>
              </div>

              <div style={styles.inputRow}>
                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Current Stock Level</label>
                  <input 
                    type="number" 
                    step="any"
                    className="glass-input"
                    value={stockLevel}
                    onChange={(e) => setStockLevel(e.target.value)}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Reorder Warning Point</label>
                  <input 
                    type="number" 
                    step="any"
                    className="glass-input"
                    value={reorderPoint}
                    onChange={(e) => setReorderPoint(e.target.value)}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Cost Price Per Unit ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="glass-input"
                  placeholder="e.g. 18.50"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
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
                  {editIng ? 'Update Spec' : 'Add Item'}
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
  categoryBadge: {
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--border-glass)',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '500'
  },
  statusNormal: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: '#10b981',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600'
  },
  statusLowStock: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600'
  },
  statusOutOfStock: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600'
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
