import React, { useState } from 'react';
import { AlertTriangle, TrendingDown, RefreshCw, Plus, X, ShieldAlert } from 'lucide-react';
import type { Ingredient } from '../types';

interface InventoryAlertsProps {
  ingredients: Ingredient[];
  loading: boolean;
  onRefresh: () => void;
  onRequestIngredient?: (ingredientId: number, quantity: number, notes: string) => void;
}

export const InventoryAlerts: React.FC<InventoryAlertsProps> = ({
  ingredients,
  loading,
  onRefresh,
  onRequestIngredient,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'warning' | 'low'>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [targetIngredientId, setTargetIngredientId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');

  const getPredictionDetails = (item: Ingredient) => {
    const ratio = item.reorder_point > 0 ? item.stock_level / item.reorder_point : 1;
    let status: 'critical' | 'warning' | 'low' | 'normal' = 'normal';
    let estDaysLeft = 15;
    let suggestedAction = 'Maintain';

    if (item.stock_level === 0) {
      status = 'critical';
      estDaysLeft = 0;
      suggestedAction = 'Contact Supplier';
    } else if (ratio <= 0.4) {
      status = 'critical';
      estDaysLeft = Math.max(1, Math.ceil(ratio * 10));
      suggestedAction = 'Contact Supplier';
    } else if (ratio <= 0.7) {
      status = 'warning';
      estDaysLeft = Math.max(2, Math.ceil(ratio * 10));
      suggestedAction = 'Monitor';
    } else if (ratio <= 1.0) {
      status = 'low';
      estDaysLeft = Math.max(5, Math.ceil(ratio * 12));
      suggestedAction = 'Monitor';
    } else {
      status = 'normal';
      estDaysLeft = Math.ceil(ratio * 15);
      suggestedAction = 'Maintain';
    }

    return { status, estDaysLeft, suggestedAction };
  };

  // Sort ingredients by urgency
  const sortedIngredients = [...ingredients].sort((a, b) => {
    const ratioA = a.reorder_point > 0 ? a.stock_level / a.reorder_point : 1;
    const ratioB = b.reorder_point > 0 ? b.stock_level / b.reorder_point : 1;
    return ratioA - ratioB;
  });

  const filteredItems = sortedIngredients.filter((item) => {
    if (filterStatus === 'all') return true;
    const { status } = getPredictionDetails(item);
    return status === filterStatus;
  });

  const criticalCount = ingredients.filter(i => getPredictionDetails(i).status === 'critical').length;
  const warningCount = ingredients.filter(i => getPredictionDetails(i).status === 'warning').length;
  const lowCount = ingredients.filter(i => getPredictionDetails(i).status === 'low').length;

  const handleOpenRefillModal = (ingId: number) => {
    const target = ingredients.find(i => i.id === ingId);
    setTargetIngredientId(ingId);
    setQuantity(target ? Math.max(10, target.reorder_point * 2) : 10);
    setNotes(`Urgent stock refill requested due to ${target ? target.name : 'low stock'} alert.`);
    setIsModalOpen(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetIngredientId && onRequestIngredient) {
      onRequestIngredient(Number(targetIngredientId), quantity, notes);
      setIsModalOpen(false);
    }
  };

  return (
    <div style={styles.container} className="fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>INVENTORY ALERT & PREDICTION</h2>
          <p style={styles.subtitle}>MONITOR CRITICAL STOCK DEPLETION & REORDER PREDICTIONS</p>
        </div>
        <button 
          onClick={onRefresh} 
          className="btn btn-secondary" 
          disabled={loading}
          style={styles.refreshBtn}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard} className="card">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>CRITICAL ITEMS</span>
            <span style={{ ...styles.kpiValue, color: criticalCount > 0 ? '#ef4444' : 'var(--text-primary)' }}>
              {criticalCount}
            </span>
          </div>
          <div style={styles.kpiIconContainer}>
            <ShieldAlert size={26} color={criticalCount > 0 ? '#ef4444' : '#4a3f35'} />
          </div>
        </div>

        <div style={styles.kpiCard} className="card">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>WARNING LEVEL</span>
            <span style={{ ...styles.kpiValue, color: warningCount > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
              {warningCount}
            </span>
          </div>
          <div style={styles.kpiIconContainer}>
            <AlertTriangle size={26} color={warningCount > 0 ? '#f59e0b' : '#4a3f35'} />
          </div>
        </div>

        <div style={styles.kpiCard} className="card">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>LOW STOCK ITEMS</span>
            <span style={{ ...styles.kpiValue, color: lowCount > 0 ? '#eab308' : 'var(--text-primary)' }}>
              {lowCount}
            </span>
          </div>
          <div style={styles.kpiIconContainer}>
            <TrendingDown size={26} color={lowCount > 0 ? '#eab308' : '#4a3f35'} />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={styles.filterGroup}>
        <button
          type="button"
          className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={styles.filterChip}
          onClick={() => setFilterStatus('all')}
        >
          All Items ({ingredients.length})
        </button>
        <button
          type="button"
          className={`btn ${filterStatus === 'critical' ? 'btn-primary' : 'btn-secondary'}`}
          style={styles.filterChip}
          onClick={() => setFilterStatus('critical')}
        >
          Critical ({criticalCount})
        </button>
        <button
          type="button"
          className={`btn ${filterStatus === 'warning' ? 'btn-primary' : 'btn-secondary'}`}
          style={styles.filterChip}
          onClick={() => setFilterStatus('warning')}
        >
          Warning ({warningCount})
        </button>
        <button
          type="button"
          className={`btn ${filterStatus === 'low' ? 'btn-primary' : 'btn-secondary'}`}
          style={styles.filterChip}
          onClick={() => setFilterStatus('low')}
        >
          Low Stock ({lowCount})
        </button>
      </div>

      {/* Prediction Sheet / Card Table */}
      <div style={styles.tableCard} className="card">
        <div style={styles.tableHeader}>
          <div>
            <h3 style={styles.tableHeaderTitle}>Inventory Alert & Depletion Sheet</h3>
            <p style={styles.tableHeaderSubtitle}>Real-time stock monitor with predicted days remaining and recommended action</p>
          </div>
        </div>

        <div style={styles.tableResponsive}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Urgency</th>
                <th style={styles.th}>Ingredient Name</th>
                <th style={styles.th}>Current Stock</th>
                <th style={styles.th}>Minimum Stock</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Est. Days Left</th>
                <th style={styles.th}>Suggested Action</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Quick Refill</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const { status, estDaysLeft, suggestedAction } = getPredictionDetails(item);
                return (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>
                      <TrendingDown 
                        size={18} 
                        color={status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#ca8a04'} 
                      />
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{item.name}</td>
                    <td style={{ ...styles.td, fontWeight: 700 }}>{item.stock_level} {item.unit}</td>
                    <td style={styles.td}>{item.reorder_point} {item.unit}</td>
                    <td style={styles.td}>
                      <span className={`badge-pill badge-${status}`}>
                        {status}
                      </span>
                    </td>
                    <td style={{ 
                      ...styles.td, 
                      color: status === 'critical' ? 'var(--danger)' : status === 'warning' ? 'var(--warning)' : '#ca8a04',
                      fontWeight: 700
                    }}>
                      {estDaysLeft === 0 ? 'Out of stock' : `${estDaysLeft} days`}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.actionBadge,
                        backgroundColor: suggestedAction === 'Contact Supplier' ? '#fffbeb' : 'var(--bg-primary)',
                        color: 'var(--accent-primary)',
                        border: '1px solid var(--border-glass)'
                      }}>
                        {suggestedAction}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {onRequestIngredient && (status === 'critical' || status === 'warning' || status === 'low') ? (
                        <button
                          onClick={() => handleOpenRefillModal(item.id)}
                          className="btn btn-primary"
                          style={styles.refillBtn}
                        >
                          <Plus size={14} /> Request Refill
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Optimal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} style={styles.emptyTd}>
                    No inventory alerts matching filter "{filterStatus}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.tableFooter}>
          <p style={styles.tableFooterText}>
            💡 <strong>Supplier Note:</strong> Typical delivery timeframe is 3 to 5 business days. Submit supply refill requests early for critical items to prevent menu item outages.
          </p>
        </div>
      </div>

      {/* QUICK REFILL REQUEST MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" style={styles.modalOverlay}>
          <div className="modal-content" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Request Urgent Supply Refill</h3>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} style={{ padding: '24px' }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Select Ingredient</label>
                <select
                  value={targetIngredientId}
                  onChange={(e) => setTargetIngredientId(Number(e.target.value))}
                  style={styles.select}
                  required
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (Current Stock: {ing.stock_level} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Quantity to Request</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes for Manager</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Request notes..."
                  style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
  },
  kpiCard: {
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '4px solid var(--border-glass)',
  },
  kpiContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  kpiLabel: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  kpiValue: {
    fontSize: '2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    lineHeight: 1,
  },
  kpiIconContainer: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    backgroundColor: 'rgba(148, 118, 86, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterGroup: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
  },
  filterChip: {
    padding: '8px 16px',
    fontSize: '0.85rem',
    borderRadius: '10px',
    fontWeight: '600',
  },
  tableCard: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  tableHeader: {
    backgroundColor: 'var(--accent-primary)',
    padding: '24px 32px',
    color: '#ffffff',
  },
  tableHeaderTitle: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  tableHeaderSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  tableResponsive: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    textAlign: 'left' as const,
  },
  th: {
    padding: '16px 32px',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border-glass)',
    backgroundColor: '#faf8f5',
  },
  tr: {
    borderBottom: '1px solid var(--border-glass)',
    transition: 'background-color 0.2s ease',
  },
  td: {
    padding: '20px 32px',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    verticalAlign: 'middle',
  },
  emptyTd: {
    padding: '40px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
  },
  actionBadge: {
    padding: '6px 14px',
    borderRadius: '100px',
    fontSize: '0.8rem',
    fontWeight: '700',
    display: 'inline-block',
  },
  refillBtn: {
    padding: '6px 12px',
    fontSize: '0.8rem',
    backgroundColor: 'var(--accent-primary)',
    borderColor: 'var(--accent-primary)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  tableFooter: {
    padding: '20px 32px',
    backgroundColor: '#faf8f5',
    borderTop: '1px solid var(--border-glass)',
  },
  tableFooterText: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    marginBottom: '16px',
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
