import React, { useState, useEffect } from 'react';
import { Archive, Plus, List, Calendar, Truck, CheckCircle2, UserCheck, Clock, FileText, ArrowRight } from 'lucide-react';
import type { StockInLog, Ingredient, IngredientRequest } from '../types';

interface RecordStockInProps {
  stockInLogs: StockInLog[];
  ingredients: Ingredient[];
  requests?: IngredientRequest[];
  onRecordStockIn: (data: any) => void;
}

export const RecordStockIn: React.FC<RecordStockInProps> = ({
  stockInLogs,
  ingredients,
  requests = [],
  onRecordStockIn
}) => {
  // Form states
  const [ingredientId, setIngredientId] = useState<string>(
    ingredients.length > 0 ? ingredients[0].id.toString() : ''
  );
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Local persistence for processed request IDs to keep state across refreshes & restarts
  const [processedIds, setProcessedIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('bb_processed_request_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bb_processed_request_ids', JSON.stringify(processedIds));
    } catch (e) {
      console.warn('Failed to save processed request IDs to localStorage:', e);
    }
  }, [processedIds]);

  // Fallback persistence for stock-in logs
  useEffect(() => {
    if (stockInLogs.length > 0) {
      try {
        localStorage.setItem('bb_stockin_logs', JSON.stringify(stockInLogs));
      } catch (e) {
        console.warn('Failed to persist stock-in logs:', e);
      }
    }
  }, [stockInLogs]);

  // Filter approved requests from staff portal queue
  const approvedRequests = requests.filter(
    (req) => req.status === 'approved' && !processedIds.includes(req.id)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientId) return;

    onRecordStockIn({
      ingredient_id: parseInt(ingredientId),
      quantity: parseFloat(quantity) || 0,
      cost: parseFloat(cost) || 0,
      supplier: supplier.trim() || 'Direct Restock',
      invoice_number: invoiceNumber.trim() || null
    });

    // Reset form
    setQuantity('');
    setCost('');
    setSupplier('');
    setInvoiceNumber('');
  };

  const handleProcessApproved = (req: IngredientRequest) => {
    const ing = ingredients.find((i) => i.id === req.ingredient_id);
    const calculatedCost = ing && ing.cost_per_unit ? ing.cost_per_unit * req.quantity : 0;

    onRecordStockIn({
      ingredient_id: req.ingredient_id,
      quantity: req.quantity,
      cost: calculatedCost > 0 ? calculatedCost : 0,
      supplier: `Staff Req: ${req.staff_name}`,
      invoice_number: `REQ-${req.id}`
    });

    setProcessedIds((prev) => [...prev, req.id]);
  };

  const handleFillFormFromRequest = (req: IngredientRequest) => {
    setIngredientId(req.ingredient_id.toString());
    setQuantity(req.quantity.toString());
    const ing = ingredients.find((i) => i.id === req.ingredient_id);
    if (ing && ing.cost_per_unit) {
      setCost((ing.cost_per_unit * req.quantity).toFixed(2));
    } else {
      setCost('');
    }
    setSupplier(`Staff Req: ${req.staff_name}`);
    setInvoiceNumber(`REQ-${req.id}`);
  };

  // Selected ingredient details
  const selectedIng = ingredients.find((i) => i.id === parseInt(ingredientId));
  const currentUnit = selectedIng ? selectedIng.unit : 'units';

  return (
    <div style={styles.container} className="page-scroll fade-in">
      <div style={styles.layoutGrid}>
        
        {/* COLUMN 1: Record Incoming Stock Form */}
        <div style={styles.card} className="glass-card">
          <div style={styles.cardHeader}>
            <div style={styles.headerTitleGroup}>
              <Archive size={20} color="#f59e0b" />
              <h3 style={styles.cardTitle}>Record Incoming Stock</h3>
            </div>
            <span style={styles.headerDesc}>Check in fresh shipments of coffee beans, packaging, or dairy products.</span>
          </div>

          <form onSubmit={handleSubmit} style={styles.formBody}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Select Ingredient to Restock</label>
              <select
                className="glass-input"
                value={ingredientId}
                onChange={(e) => setIngredientId(e.target.value)}
                style={{ width: '100%' }}
                required
              >
                <option value="" disabled>-- Select an Ingredient --</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id} style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                    {ing.name} ({ing.category} | Current: {ing.stock_level} {ing.unit})
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.inputRow}>
              <div style={{ ...styles.inputGroup, flex: 1 }}>
                <label style={styles.label}>Quantity Received</label>
                <div style={styles.inputWithSuffix}>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 25"
                    className="glass-input"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    required
                  />
                  <span style={styles.suffixText}>{currentUnit}</span>
                </div>
              </div>

              <div style={{ ...styles.inputGroup, flex: 1 }}>
                <label style={styles.label}>Total Shipment Cost (₱)</label>
                <div style={styles.inputWithPrefix}>
                  <span style={{ ...styles.prefixIcon, fontSize: '14px', fontWeight: 700 }}>₱</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 6000.00"
                    className="glass-input"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '28px' }}
                    required
                  />
                </div>
              </div>
            </div>

            <div style={styles.inputRow}>
              <div style={{ ...styles.inputGroup, flex: 1 }}>
                <label style={styles.label}>Supplier / Vendor Name</label>
                <div style={styles.inputWithPrefix}>
                  <Truck size={14} style={styles.prefixIcon} />
                  <input
                    type="text"
                    placeholder="e.g. Columbia Importers"
                    className="glass-input"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '28px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ ...styles.inputGroup, flex: 1 }}>
                <label style={styles.label}>Invoice Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. INV-99881"
                  className="glass-input"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', justifyContent: 'center' }}>
              <Plus size={16} />
              <span>Record &amp; Add Stock</span>
            </button>
          </form>
        </div>

        {/* COLUMN 2: Approved Stock In Requests Sheet (NEW) */}
        <div style={styles.card} className="glass-card">
          <div style={styles.cardHeader}>
            <div style={styles.headerTitleGroup}>
              <CheckCircle2 size={20} color="#10b981" />
              <h3 style={styles.cardTitle}>Approved Stock In Requests</h3>
            </div>
            <span style={styles.headerDesc}>Staff portal approved supply requests ready to process into inventory.</span>
          </div>

          <div style={styles.requestListContainer} className="table-scroll">
            {approvedRequests.length === 0 ? (
              <div style={styles.emptyState}>
                <CheckCircle2 size={32} color="#10b981" style={{ opacity: 0.5, marginBottom: '8px' }} />
                <span>No approved supply requests pending check-in.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {approvedRequests.map((req) => {
                  const ing = ingredients.find((i) => i.id === req.ingredient_id);
                  const ingName = req.ingredient_name || ing?.name || `Ingredient #${req.ingredient_id}`;
                  const ingUnit = req.ingredient_unit || ing?.unit || 'units';

                  return (
                    <div key={req.id} style={styles.approvedCardItem}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={styles.approvedBadge}>
                          ✓ Approved by Staff
                        </span>
                        <span style={styles.timestampText}>
                          <Clock size={11} style={{ marginRight: '4px' }} />
                          {new Date(req.requested_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {ingName}
                        </span>
                        <span style={{ fontWeight: '800', fontSize: '1rem', color: '#10b981' }}>
                          +{req.quantity} {ingUnit}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <UserCheck size={12} color="var(--text-muted)" />
                          <span>Requested by: <strong>{req.staff_name}</strong></span>
                        </div>
                        {req.notes && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <FileText size={12} color="var(--text-muted)" />
                            <span>Notes: {req.notes}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleProcessApproved(req)}
                          style={{
                            flex: 1,
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            padding: '8px 12px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none'
                          }}
                        >
                          <Plus size={14} />
                          <span>Process Stock-In</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleFillFormFromRequest(req)}
                          style={{
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            padding: '8px 12px'
                          }}
                          title="Fill form to edit supplier/cost"
                        >
                          <ArrowRight size={14} />
                          <span>Fill Form</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: Recent Shipment Logs Table */}
        <div style={styles.card} className="glass-card">
          <div style={styles.cardHeader}>
            <div style={styles.headerTitleGroup}>
              <List size={20} color="#3b82f6" />
              <h3 style={styles.cardTitle}>Recent Shipment Logs</h3>
            </div>
            <span style={styles.headerDesc}>Audit logs of registered deliveries and supply restocks.</span>
          </div>

          <div style={styles.tableContainer} className="table-scroll">
            {stockInLogs.length === 0 ? (
              <div style={styles.emptyState}>
                <span>No stock-in entries recorded yet.</span>
              </div>
            ) : (
              <table className="crud-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Date Received</th>
                    <th>Ingredient</th>
                    <th>Qty Restocked</th>
                    <th>Total Cost</th>
                    <th>Supplier / Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {stockInLogs.slice(0, 10).map((log) => (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} color="var(--text-muted)" />
                          <span>{new Date(log.received_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{log.ingredient_name}</td>
                      <td style={{ fontWeight: '700', color: '#10b981' }}>
                        +{log.quantity} {log.ingredient_unit}
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        ₱{log.cost.toFixed(2)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{log.supplier}</span>
                          {log.invoice_number && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Ref: {log.invoice_number}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    boxSizing: 'border-box' as const,
    minHeight: 0,
    flex: 1
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px',
    alignItems: 'start',
    width: '100%'
  },
  card: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const,
    maxHeight: 'calc(100vh - 160px)',
    minHeight: '480px',
    overflow: 'hidden'
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '16px',
    marginBottom: '20px'
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  headerDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  formBody: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
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
  inputWithSuffix: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center'
  },
  suffixText: {
    position: 'absolute' as const,
    right: '12px',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: '600'
  },
  inputWithPrefix: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center'
  },
  prefixIcon: {
    position: 'absolute' as const,
    left: '10px',
    color: 'var(--text-muted)'
  },
  tableContainer: {
    overflowY: 'auto' as const,
    minHeight: 0,
    flex: 1
  },
  requestListContainer: {
    overflowY: 'auto' as const,
    minHeight: 0,
    flex: 1
  },
  approvedCardItem: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-glass)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'all 0.2s ease'
  },
  approvedBadge: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '0.72rem',
    fontWeight: 700
  },
  timestampText: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '220px',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontStyle: 'italic',
    textAlign: 'center' as const
  }
};
