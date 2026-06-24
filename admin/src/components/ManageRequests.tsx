import React, { useState } from 'react';
import { Check, X, Filter, Plus, Calendar, User } from 'lucide-react';
import type { IngredientRequest, Ingredient } from '../types';

interface ManageRequestsProps {
  requests: IngredientRequest[];
  ingredients: Ingredient[];
  onCreateRequest: (data: any) => void;
  onApproveRequest: (id: number) => void;
  onRejectRequest: (id: number) => void;
  onDeleteRequest: (id: number) => void;
}

export const ManageRequests: React.FC<ManageRequestsProps> = ({
  requests,
  ingredients,
  onCreateRequest,
  onApproveRequest,
  onRejectRequest,
  onDeleteRequest
}) => {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // New request form states
  const [ingredientId, setIngredientId] = useState<string>('');
  const [staffName, setStaffName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientId) return;

    onCreateRequest({
      ingredient_id: parseInt(ingredientId),
      staff_name: staffName,
      quantity: parseFloat(quantity) || 0,
      notes: notes || null
    });

    setShowModal(false);
    setIngredientId('');
    setStaffName('');
    setQuantity('');
    setNotes('');
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          color: '#10b981'
        };
      case 'rejected':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ef4444'
        };
      default:
        return {
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          color: '#f59e0b'
        };
    }
  };

  // Filter requests
  const filtered = requests.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  return (
    <div style={styles.container} className="fade-in">
      {/* Filters Header Bar */}
      <div style={styles.header}>
        <div style={styles.filterGroup}>
          <Filter size={16} color="#9ca3af" />
          <select
            className="glass-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ paddingRight: '24px' }}
          >
            <option value="all">All Request Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved Requests</option>
            <option value="rejected">Rejected Requests</option>
          </select>
        </div>

        <button 
          onClick={() => {
            if (ingredients.length > 0) {
              setIngredientId(ingredients[0].id.toString());
            }
            setShowModal(true);
          }} 
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>New Ingredient Request</span>
        </button>
      </div>

      {/* Requests table listing */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="crud-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Quantity Requested</th>
              <th>Requested By</th>
              <th>Date Requested</th>
              <th>Notes / Remarks</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                  No stock requests logged.
                </td>
              </tr>
            ) : (
              filtered.map((req) => (
                <tr key={req.id}>
                  <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{req.ingredient_name}</td>
                  <td style={{ fontWeight: '700', color: '#f59e0b' }}>
                    {req.quantity} {req.ingredient_unit}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={12} color="#9ca3af" />
                      <span>{req.staff_name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={12} color="#9ca3af" />
                      <span>{new Date(req.requested_at).toLocaleString()}</span>
                    </div>
                  </td>
                  <td style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>
                    {req.notes || <span style={{ color: '#4b5563' }}>--</span>}
                  </td>
                  <td>
                    <span style={{
                      ...styles.statusBadge,
                      ...getStatusStyle(req.status)
                    }}>
                      {req.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {req.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => onApproveRequest(req.id)}
                          className="btn btn-primary"
                          style={{ padding: '6px 10px', backgroundColor: '#10b981' }}
                          title="Approve Request"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => onRejectRequest(req.id)}
                          className="btn btn-danger"
                          style={{ padding: '6px 10px' }}
                          title="Reject Request"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onDeleteRequest(req.id)}
                        className="btn btn-danger"
                        style={{ padding: '6px 10px', opacity: 0.6 }}
                        title="Remove Entry Log"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Request Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Request Bar/Kitchen Ingredients</h3>
              <button onClick={() => setShowModal(false)} className="modal-close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={styles.modalBody}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Select Ingredient</label>
                <select 
                  className="glass-input"
                  value={ingredientId}
                  onChange={(e) => setIngredientId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                >
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {ing.name} (Current: {ing.stock_level} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.inputRow}>
                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Your Name (Staff)</label>
                  <input 
                    type="text" 
                    className="glass-input"
                    placeholder="e.g. Jane Smith"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ ...styles.inputGroup, width: '130px' }}>
                  <label style={styles.label}>Quantity Needed</label>
                  <input 
                    type="number" 
                    step="any"
                    className="glass-input"
                    placeholder="e.g. 5"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Notes / Purpose</label>
                <textarea 
                  className="glass-input"
                  placeholder="Describe the usage requirement..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: '80px', fontFamily: 'inherit', resize: 'none' }}
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
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.02em',
    display: 'inline-block'
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
