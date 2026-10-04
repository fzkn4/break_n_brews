import React, { useState } from 'react';
import { FileText, Plus, RefreshCw, CheckCircle, XCircle, Clock, X } from 'lucide-react';
import type { Ingredient, IngredientRequest } from '../types';

interface IngredientSupplyRequestsProps {
  requests: IngredientRequest[];
  ingredients: Ingredient[];
  loading: boolean;
  onRefresh: () => void;
  onUpdateRequestStatus?: (id: number, status: 'approved' | 'rejected') => void;
  onRequestIngredient?: (ingredientId: number, quantity: number, notes: string) => void;
}

export const IngredientSupplyRequests: React.FC<IngredientSupplyRequestsProps> = ({
  requests,
  ingredients,
  loading,
  onRefresh,
  onUpdateRequestStatus,
  onRequestIngredient,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');

  const filteredRequests = requests.filter((req) => {
    if (statusFilter === 'all') return true;
    return req.status === statusFilter;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

  const handleOpenModal = () => {
    if (ingredients.length > 0) {
      setSelectedIngredientId(ingredients[0].id);
    }
    setQuantity(1);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIngredientId && onRequestIngredient) {
      onRequestIngredient(Number(selectedIngredientId), quantity, notes);
      setIsModalOpen(false);
    }
  };

  return (
    <div style={styles.container} className="fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>INGREDIENTS SUPPLY REQUEST</h2>
          <p style={styles.subtitle}>SUBMIT & MONITOR INGREDIENT REFILL REQUESTS</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {onRequestIngredient && (
            <button
              onClick={handleOpenModal}
              className="btn btn-primary"
              style={styles.actionBtn}
            >
              <Plus size={18} />
              <span>New Supply Request</span>
            </button>
          )}
          <button 
            onClick={onRefresh} 
            className="btn btn-secondary" 
            disabled={loading}
            style={styles.refreshBtn}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Summary Row */}
      <div style={styles.summaryRow}>
        <div style={styles.filterGroup}>
          <button
            type="button"
            className={`btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={styles.filterChip}
            onClick={() => setStatusFilter('all')}
          >
            All Requests ({requests.length})
          </button>
          <button
            type="button"
            className={`btn ${statusFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            style={styles.filterChip}
            onClick={() => setStatusFilter('pending')}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            className={`btn ${statusFilter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
            style={styles.filterChip}
            onClick={() => setStatusFilter('approved')}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            className={`btn ${statusFilter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
            style={styles.filterChip}
            onClick={() => setStatusFilter('rejected')}
          >
            Rejected ({rejectedCount})
          </button>
        </div>
      </div>

      {/* Main Request Sheet / Card */}
      <div style={styles.tableCard} className="card">
        <div style={styles.tableHeader}>
          <div>
            <h3 style={styles.tableHeaderTitle}>Supply Refill Queue</h3>
            <p style={styles.tableHeaderSubtitle}>
              List of all ingredient restock applications sent to management
            </p>
          </div>
          <span style={styles.badgeCount}>
            {pendingCount} Pending Manager Review
          </span>
        </div>

        <div style={styles.tableResponsive}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Req ID</th>
                <th style={styles.th}>Ingredient</th>
                <th style={styles.th}>Requested By</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Date & Time</th>
                <th style={styles.th}>Notes</th>
                <th style={styles.th}>Status</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => (
                <tr key={req.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 700 }}>#{req.id}</td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>
                    {req.ingredient_name || `Ingredient #${req.ingredient_id}`}
                  </td>
                  <td style={styles.td}>{req.staff_name}</td>
                  <td style={{ ...styles.td, fontWeight: 700 }}>
                    {req.quantity} {req.ingredient_unit}
                  </td>
                  <td style={{ ...styles.td, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(req.requested_at).toLocaleString()}
                  </td>
                  <td style={{ ...styles.td, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    {req.notes || 'No notes provided'}
                  </td>
                  <td style={styles.td}>
                    {req.status === 'approved' ? (
                      <span className="badge-pill" style={{ backgroundColor: '#d1fae5', color: '#065f46', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={14} /> Approved
                      </span>
                    ) : req.status === 'rejected' ? (
                      <span className="badge-pill" style={{ backgroundColor: '#fee2e2', color: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <XCircle size={14} /> Rejected
                      </span>
                    ) : (
                      <span className="badge-pill" style={{ backgroundColor: '#fef3c7', color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} /> Pending
                      </span>
                    )}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {req.status === 'pending' && onUpdateRequestStatus ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => onUpdateRequestStatus(req.id, 'approved')}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#10b981', borderColor: '#10b981' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onUpdateRequestStatus(req.id, 'rejected')}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={8} style={styles.emptyTd}>
                    No supply requests found matching status "{statusFilter}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW SUPPLY REQUEST MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" style={styles.modalOverlay}>
          <div className="modal-content" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={20} />
                <h3 style={styles.modalTitle}>Submit Ingredients Supply Request</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} style={{ padding: '24px' }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Select Ingredient to Restock</label>
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(Number(e.target.value))}
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
                <label style={styles.label}>Quantity Requested</label>
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
                <label style={styles.label}>Notes / Request Reason</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Expected weekend surge or unexpected high usage"
                  style={{ ...styles.input, minHeight: '90px', resize: 'vertical' }}
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
                  Submit Request
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
  actionBtn: {
    height: '42px',
    backgroundColor: 'var(--accent-primary)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 20px',
    borderRadius: '10px',
    fontWeight: '700',
  },
  refreshBtn: {
    height: '42px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  badgeCount: {
    fontSize: '0.85rem',
    fontWeight: '700',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: '6px 14px',
    borderRadius: '12px',
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
    maxWidth: '520px',
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
