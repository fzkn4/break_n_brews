import React, { useState } from 'react';
import { AlertTriangle, TrendingDown, RefreshCw, Plus, X, ShieldAlert, FileText } from 'lucide-react';
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
  const [modalMode, setModalMode] = useState<'new' | 'refill'>('new');
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

  const handleOpenNewSupplyRequestModal = () => {
    if (ingredients.length > 0) {
      setTargetIngredientId(ingredients[0].id);
    } else {
      setTargetIngredientId('');
    }
    setQuantity(5);
    setNotes('');
    setModalMode('new');
    setIsModalOpen(true);
  };

  const handleOpenRefillModal = (ingId: number) => {
    const target = ingredients.find(i => i.id === ingId);
    setTargetIngredientId(ingId);
    setQuantity(target ? Math.max(5, target.reorder_point * 2) : 5);
    setNotes(`Urgent stock refill requested due to ${target ? target.name : 'low stock'} alert.`);
    setModalMode('refill');
    setIsModalOpen(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetIngredientId && onRequestIngredient) {
      onRequestIngredient(Number(targetIngredientId), quantity, notes);
      setIsModalOpen(false);
    }
  };

  const selectedTargetIngredient = ingredients.find(i => i.id === Number(targetIngredientId));

  return (
    <div style={styles.container} className="fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>INVENTORY ALERT & PREDICTION</h2>
          <p style={styles.subtitle}>MONITOR CRITICAL STOCK DEPLETION & REORDER PREDICTIONS</p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard} className="card">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>CRITICAL ITEMS</span>
            <span style={{ ...styles.kpiValue, color: criticalCount > 0 ? '#FF4D4D' : 'var(--text-primary)' }}>
              {criticalCount}
            </span>
          </div>
          <div style={styles.kpiIconContainer}>
            <ShieldAlert size={26} color={criticalCount > 0 ? '#FF4D4D' : '#4a3f35'} />
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

      {/* Filter Tabs & Inlined Action Buttons */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <button
            type="button"
            className="btn"
            style={{
              ...styles.filterChip,
              backgroundColor: filterStatus === 'all' ? '#D4A373' : 'rgba(30, 30, 35, 0.65)',
              color: filterStatus === 'all' ? '#ffffff' : 'rgba(248, 250, 252, 0.85)',
              border: filterStatus === 'all' ? '1px solid #D4A373' : '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setFilterStatus('all')}
          >
            All Items ({ingredients.length})
          </button>
          <button
            type="button"
            className="btn"
            style={{
              ...styles.filterChip,
              backgroundColor: filterStatus === 'critical' ? '#ef4444' : 'rgba(30, 30, 35, 0.65)',
              color: '#ffffff',
              border: filterStatus === 'critical' ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setFilterStatus('critical')}
          >
            Critical ({criticalCount})
          </button>
          <button
            type="button"
            className="btn"
            style={{
              ...styles.filterChip,
              backgroundColor: filterStatus === 'warning' ? '#f59e0b' : 'rgba(30, 30, 35, 0.65)',
              color: '#ffffff',
              border: filterStatus === 'warning' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setFilterStatus('warning')}
          >
            Warning ({warningCount})
          </button>
          <button
            type="button"
            className="btn"
            style={{
              ...styles.filterChip,
              backgroundColor: filterStatus === 'low' ? '#ca8a04' : 'rgba(30, 30, 35, 0.65)',
              color: '#ffffff',
              border: filterStatus === 'low' ? '1px solid #ca8a04' : '1px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setFilterStatus('low')}
          >
            Low Stock ({lowCount})
          </button>
        </div>

        <div style={styles.actionButtonsGroup}>
          {onRequestIngredient && (
            <button 
              onClick={handleOpenNewSupplyRequestModal}
              className="btn btn-primary"
              style={styles.newRequestBtn}
              title="Submit a new ingredient refill request to management"
            >
              <Plus size={16} />
              <span>New Supply Request</span>
            </button>
          )}
          <button 
            onClick={onRefresh} 
            className="btn btn-secondary" 
            disabled={loading}
            style={styles.refreshBtn}
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh Data</span>
          </button>
        </div>
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
                    <td style={{ ...styles.td, fontWeight: 600, color: '#FFFFFF' }}>{item.name}</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: '#FFFFFF' }}>{item.stock_level} {item.unit}</td>
                    <td style={{ ...styles.td, color: '#E2E8F0' }}>{item.reorder_point} {item.unit}</td>
                    <td style={styles.td}>
                      <span className={`badge-pill badge-${status}`}>
                        {status}
                      </span>
                    </td>
                    <td style={{ 
                      ...styles.td, 
                      color: status === 'critical' ? '#FF4D4D' : status === 'warning' ? '#F59E0B' : '#EAB308',
                      fontWeight: 700
                    }}>
                      {estDaysLeft === 0 ? 'Out of stock' : `${estDaysLeft} days`}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.actionBadge,
                        backgroundColor: suggestedAction === 'Contact Supplier' 
                          ? 'rgba(239, 68, 68, 0.18)' 
                          : suggestedAction === 'Monitor'
                          ? 'rgba(245, 158, 11, 0.18)'
                          : 'rgba(212, 163, 115, 0.15)',
                        color: suggestedAction === 'Contact Supplier' 
                          ? '#FF6B6B' 
                          : suggestedAction === 'Monitor'
                          ? '#FBBF24'
                          : '#D4A373',
                        border: suggestedAction === 'Contact Supplier'
                          ? '1px solid rgba(239, 68, 68, 0.4)'
                          : suggestedAction === 'Monitor'
                          ? '1px solid rgba(245, 158, 11, 0.4)'
                          : '1px solid rgba(212, 163, 115, 0.35)',
                      }}>
                        {suggestedAction}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {onRequestIngredient && (status === 'critical' || status === 'warning' || status === 'low') ? (
                        <button
                          onClick={() => handleOpenRefillModal(item.id)}
                          style={styles.refillBtn}
                        >
                          <Plus size={14} /> Request Refill
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Optimal</span>
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

      {/* SUPPLY REQUEST & REFILL MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" style={styles.modalOverlay}>
          <div className="modal-content" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {modalMode === 'new' ? <FileText size={20} /> : <AlertTriangle size={20} />}
                <h3 style={styles.modalTitle}>
                  {modalMode === 'new' ? 'Submit Ingredients Supply Request' : 'Request Urgent Supply Refill'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn} title="Close">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} style={{ padding: '24px' }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {modalMode === 'new' ? 'Select Ingredient to Restock' : 'Select Ingredient'}
                </label>
                <select
                  value={targetIngredientId}
                  onChange={(e) => setTargetIngredientId(Number(e.target.value))}
                  style={styles.select}
                  required
                >
                  <option value="" disabled>Choose an ingredient...</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (Current Stock: {ing.stock_level} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Quantity to Request {selectedTargetIngredient ? `(${selectedTargetIngredient.unit})` : ''}
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0.1, parseFloat(e.target.value) || 0))}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {modalMode === 'new' ? 'Notes / Request Reason' : 'Notes for Manager'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    modalMode === 'new'
                      ? 'e.g. Expected weekend rush, bar restocking, or special event requirement'
                      : 'Request notes...'
                  }
                  style={{ ...styles.input, minHeight: '85px', resize: 'vertical' }}
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
                  {modalMode === 'new' ? 'Submit Request' : 'Send Request'}
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
    color: '#F8FAFC',
    letterSpacing: '1px',
    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: 'rgba(248, 250, 252, 0.85)',
    fontWeight: '600',
    letterSpacing: '0.5px',
    textShadow: '0 1px 6px rgba(0,0,0,0.4)',
  },
  newRequestBtn: {
    height: '40px',
    backgroundColor: '#D4A373',
    color: '#ffffff',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 700,
    padding: '0 18px',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(212, 163, 115, 0.25)',
  },
  refreshBtn: {
    height: '40px',
    backgroundColor: 'rgba(30, 30, 35, 0.65)',
    color: '#F8FAFC',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 16px',
    borderRadius: '10px',
    fontWeight: 600,
    cursor: 'pointer',
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
    background: 'rgba(12, 12, 15, 0.88)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
  },
  kpiContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  kpiLabel: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
  },
  kpiValue: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#FFFFFF',
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
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '16px',
    width: '100%',
  },
  filterGroup: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  },
  actionButtonsGroup: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  filterChip: {
    padding: '8px 18px',
    fontSize: '0.85rem',
    borderRadius: '10px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tableCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'rgba(12, 12, 15, 0.88)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
  },
  tableHeader: {
    background: 'rgba(12, 12, 15, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '24px 32px',
    color: '#ffffff',
  },
  tableHeaderTitle: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
    color: '#F8FAFC',
  },
  tableHeaderSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: 'rgba(248, 250, 252, 0.75)',
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
    fontSize: '0.82rem',
    fontWeight: '700',
    color: '#E2E8F0',
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(12, 12, 15, 0.88)',
  },
  tr: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    transition: 'background-color 0.2s ease',
  },
  td: {
    padding: '18px 32px',
    fontSize: '0.92rem',
    color: '#FFFFFF',
    verticalAlign: 'middle',
  },
  emptyTd: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#E2E8F0',
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
    padding: '7px 14px',
    fontSize: '0.82rem',
    backgroundColor: 'rgba(212, 163, 115, 0.15)',
    border: '1px solid #D4A373',
    color: '#D4A373',
    borderRadius: '10px',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tableFooter: {
    padding: '18px 32px',
    backgroundColor: 'rgba(12, 12, 15, 0.95)',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  tableFooterText: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#E2E8F0',
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
    color: '#E2E8F0',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(15, 15, 20, 0.7)',
    fontSize: '0.95rem',
    color: '#FFFFFF',
    outline: 'none',
  },
  select: {
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(15, 15, 20, 0.85)',
    fontSize: '0.95rem',
    color: '#FFFFFF',
    outline: 'none',
  },
  modalOverlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  modalContent: {
    margin: 'auto',
    transform: 'none',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    width: '100%',
    maxWidth: '500px',
    backgroundColor: 'rgba(12, 12, 15, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    boxShadow: '0 25px 60px -5px rgba(0, 0, 0, 0.8)',
    color: '#FFFFFF',
    position: 'relative' as const,
  },
  modalHeader: {
    padding: '20px 24px',
    backgroundColor: 'rgba(12, 12, 15, 0.95)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#FFFFFF',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
};
