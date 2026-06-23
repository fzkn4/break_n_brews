import React, { useState } from 'react';
import { Archive, Plus, List, Calendar, Truck, DollarSign } from 'lucide-react';
import type { StockInLog, Ingredient } from '../types';

interface RecordStockInProps {
  stockInLogs: StockInLog[];
  ingredients: Ingredient[];
  onRecordStockIn: (data: any) => void;
}

export const RecordStockIn: React.FC<RecordStockInProps> = ({
  stockInLogs,
  ingredients,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientId) return;

    onRecordStockIn({
      ingredient_id: parseInt(ingredientId),
      quantity: parseFloat(quantity) || 0,
      cost: parseFloat(cost) || 0,
      supplier,
      invoice_number: invoiceNumber || null
    });

    // Reset form
    setQuantity('');
    setCost('');
    setSupplier('');
    setInvoiceNumber('');
  };

  // Get selected ingredient unit
  const selectedIng = ingredients.find(i => i.id === parseInt(ingredientId));
  const currentUnit = selectedIng ? selectedIng.unit : 'units';

  return (
    <div style={styles.container} className="fade-in">
      <div style={styles.layoutGrid}>
        
        {/* LEFT COLUMN: Record Shipment Form */}
        <div style={styles.formCard} className="glass-card">
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
                {ingredients.map(ing => (
                  <option key={ing.id} value={ing.id} style={{ backgroundColor: '#121217' }}>
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
                <label style={styles.label}>Total Shipment Cost ($)</label>
                <div style={styles.inputWithPrefix}>
                  <DollarSign size={14} style={styles.prefixIcon} />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 150.00"
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
              <span>Record & Add Stock</span>
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Recent Shipment History */}
        <div style={styles.historyCard} className="glass-card">
          <div style={styles.cardHeader}>
            <div style={styles.headerTitleGroup}>
              <List size={20} color="#3b82f6" />
              <h3 style={styles.cardTitle}>Recent Shipment Logs</h3>
            </div>
            <span style={styles.headerDesc}>Audit logs of registered deliveries and supply restocks.</span>
          </div>

          <div style={styles.tableContainer}>
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
                      <td style={{ color: '#9ca3af' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} color="#6b7280" />
                          <span>{new Date(log.received_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: '600', color: '#fff' }}>{log.ingredient_name}</td>
                      <td style={{ fontWeight: '700', color: '#10b981' }}>
                        +{log.quantity} {log.ingredient_unit}
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        ${log.cost.toFixed(2)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                          <span style={{ fontWeight: '500', color: '#fff' }}>{log.supplier}</span>
                          {log.invoice_number && (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
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
    overflowY: 'auto' as const,
    flex: 1
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '24px',
    alignItems: 'start',
    width: '100%'
  },
  formCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const
  },
  historyCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const,
    maxHeight: '520px',
    overflow: 'hidden'
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
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
    color: '#fff'
  },
  headerDesc: {
    fontSize: '0.75rem',
    color: '#9ca3af'
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
    color: '#9ca3af',
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
    color: '#9ca3af',
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
    color: '#9ca3af'
  },
  tableContainer: {
    overflowY: 'auto' as const,
    flex: 1
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#6b7280',
    fontSize: '0.85rem',
    fontStyle: 'italic'
  }
};
