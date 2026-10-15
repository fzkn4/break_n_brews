import React, { useState } from 'react';
import { 
  ClipboardList, 
  Plus, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  X, 
  Check, 
  FileText 
} from 'lucide-react';
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
  const [submitting, setSubmitting] = useState<boolean>(false);

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

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIngredientId && onRequestIngredient) {
      setSubmitting(true);
      await onRequestIngredient(Number(selectedIngredientId), quantity, notes);
      setSubmitting(false);
      setIsModalOpen(false);
    }
  };

  return (
    <div style={styles.container} className="page-scroll fade-in">
      {/* Page Header */}
      <div style={styles.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={22} color="#D4A373" />
            <h2 style={styles.title}>INGREDIENTS SUPPLY REQUEST</h2>
          </div>
          <p style={styles.subtitle}>SUBMIT &amp; MONITOR INGREDIENT REFILL APPLICATIONS</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {onRequestIngredient && (
            <button
              onClick={handleOpenModal}
              className="btn btn-primary"
              style={styles.actionBtn}
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
            title="Refresh requests list"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Summary Row */}
      <div style={styles.filterRow}>
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
          style={{
            ...styles.filterChip,
            ...(statusFilter === 'pending' ? { background: '#f59e0b', borderColor: '#f59e0b', color: '#000' } : {})
          }}
          onClick={() => setStatusFilter('pending')}
        >
          Pending ({pendingCount})
        </button>
        <button
          type="button"
          className={`btn ${statusFilter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            ...styles.filterChip,
            ...(statusFilter === 'approved' ? { background: '#10b981', borderColor: '#10b981', color: '#fff' } : {})
          }}
          onClick={() => setStatusFilter('approved')}
        >
          Approved ({approvedCount})
        </button>
        <button
          type="button"
          className={`btn ${statusFilter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            ...styles.filterChip,
            ...(statusFilter === 'rejected' ? { background: '#ef4444', borderColor: '#ef4444', color: '#fff' } : {})
          }}
          onClick={() => setStatusFilter('rejected')}
        >
          Rejected ({rejectedCount})
        </button>
      </div>

      {/* Main Request Sheet / Card */}
      <div style={styles.card} className="glass-card">
        <div style={styles.cardHeader}>
          <div>
            <h3 style={styles.cardTitle}>Supply Refill Queue</h3>
            <span style={styles.cardDesc}>
              List of all ingredient restock applications sent to management for review.
            </span>
          </div>
          <span style={styles.badgeCount}>
            {pendingCount} Pending Review
          </span>
        </div>

        <div style={styles.tableResponsive} className="table-scroll">
          <table className="crud-table" style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Req ID</th>
                <th style={styles.th}>Ingredient</th>
                <th style={styles.th}>Requested By</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Date &amp; Time</th>
                <th style={styles.th}>Notes</th>
                <th style={styles.th}>Status</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => (
                <tr key={req.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>
                    #{req.id}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {req.ingredient_name || `Ingredient #${req.ingredient_id}`}
                  </td>
                  <td style={{ color: 'var(--text-primary)' }}>{req.staff_name}</td>
                  <td style={{ fontWeight: 700, color: '#f59e0b' }}>
                    {req.quantity} {req.ingredient_unit}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(req.requested_at).toLocaleString(undefined, { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </td>
                  <td style={{ fontStyle: 'italic', color: 'var(--text-muted)', maxWidth: '240px' }}>
                    {req.notes || 'No notes provided'}
                  </td>
                  <td>
                    {req.status === 'approved' ? (
                      <span style={styles.statusApproved}>
                        <CheckCircle size={13} /> Approved
                      </span>
                    ) : req.status === 'rejected' ? (
                      <span style={styles.statusRejected}>
                        <XCircle size={13} /> Rejected
                      </span>
                    ) : (
                      <span style={styles.statusPending}>
                        <Clock size={13} /> Pending Review
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {req.status === 'pending' && onUpdateRequestStatus ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => onUpdateRequestStatus(req.id, 'approved')}
                          className="btn btn-primary"
                          style={styles.approveBtn}
                          title="Approve and deduct stock"
                        >
                          <Check size={14} />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateRequestStatus(req.id, 'rejected')}
                          className="btn btn-secondary"
                          style={styles.rejectBtn}
                          title="Reject refill request"
                        >
                          <X size={14} />
                          <span>Reject</span>
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

      {/* NEW SUPPLY REFILL REQUEST MODAL */}
      {isModalOpen && (
        <div style={styles.modalOverlay} onClick={() => !submitting && setIsModalOpen(false)}>
          <div
            style={styles.modalCard}
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Submit Ingredients Supply Request
                </h3>
              </div>
              <button 
                type="button" 
                style={styles.iconBtn} 
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Create an official application to restock an ingredient.
            </p>

            <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={styles.label}>Select Ingredient to Restock <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(Number(e.target.value))}
                  className="glass-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {ing.name} · Current Stock: {ing.stock_level} {ing.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Quantity Requested <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                  className="glass-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={styles.label}>Notes / Request Reason</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Expected weekend rush, bar 2 low stock"
                  className="glass-input"
                  style={{ width: '100%', minHeight: '85px', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ opacity: submitting ? 0.7 : 1 }}
                >
                  <Plus size={15} />
                  <span>{submitting ? 'Submitting…' : 'Submit Request'}</span>
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
    minHeight: 0,
    flex: 1
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '0.03em',
  },
  subtitle: {
    margin: '3px 0 0',
    fontSize: '0.74rem',
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
    fontWeight: 600,
  },
  actionBtn: {
    padding: '8px 14px',
    fontSize: '0.84rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 600,
  },
  refreshBtn: {
    padding: '8px 14px',
    fontSize: '0.84rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  filterChip: {
    padding: '6px 14px',
    fontSize: '0.8rem',
    borderRadius: '999px',
    fontWeight: 600,
  },
  card: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const,
    background: 'rgba(12, 12, 15, 0.88)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '16px',
    marginBottom: '16px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#FFFFFF',
  },
  cardDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '3px',
    display: 'block',
  },
  badgeCount: {
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '4px 10px',
    borderRadius: '999px',
    background: 'rgba(212, 163, 115, 0.15)',
    color: '#D4A373',
    border: '1px solid rgba(212, 163, 115, 0.35)',
    whiteSpace: 'nowrap' as const,
  },
  tableResponsive: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    fontSize: '0.85rem',
  },
  th: {
    padding: '12px 14px',
    textAlign: 'left' as const,
    color: '#E2E8F0',
    fontSize: '0.74rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: 700,
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(12, 12, 15, 0.95)',
  },
  statusApproved: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '4px 9px',
    borderRadius: '999px',
    color: '#10b981',
    background: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.35)',
    whiteSpace: 'nowrap' as const,
  },
  statusRejected: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '4px 9px',
    borderRadius: '999px',
    color: '#FF4D4D',
    background: 'rgba(255, 77, 77, 0.15)',
    border: '1px solid rgba(255, 77, 77, 0.4)',
    whiteSpace: 'nowrap' as const,
  },
  statusPending: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '4px 9px',
    borderRadius: '999px',
    color: '#D4A373',
    background: 'rgba(212, 163, 115, 0.15)',
    border: '1px solid rgba(212, 163, 115, 0.35)',
    whiteSpace: 'nowrap' as const,
  },
  approveBtn: {
    padding: '5px 10px',
    fontSize: '0.76rem',
    background: '#10b981',
    borderColor: '#10b981',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: 700,
    borderRadius: '8px',
  },
  rejectBtn: {
    padding: '5px 10px',
    fontSize: '0.76rem',
    borderColor: 'rgba(255, 77, 77, 0.4)',
    color: '#FF4D4D',
    background: 'rgba(255, 77, 77, 0.12)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: 700,
    borderRadius: '8px',
  },
  emptyTd: {
    padding: '40px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    display: 'block',
    marginBottom: '4px',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
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
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    padding: '20px',
    boxSizing: 'border-box' as const,
  },
  modalCard: {
    margin: 'auto',
    transform: 'none',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    width: '100%',
    maxWidth: '460px',
    background: 'rgba(12, 12, 15, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: '#FFFFFF',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
    textAlign: 'left' as const,
    position: 'relative' as const,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
};
