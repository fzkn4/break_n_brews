import React, { useState, useEffect } from 'react';
import { List, Calendar, CheckCircle2, UserCheck, Clock, FileText, ArrowRight } from 'lucide-react';
import type { StockInLog, Ingredient, IngredientRequest, StockBatch, StockInPayload } from '../types';
import { ReceiveStockForm, type StockInPrefill } from './ReceiveStockForm';
import { BatchQueue } from './BatchQueue';
import { formatExpiry, formatQty, parseServerTime } from '../lib/expiry';

interface RecordStockInProps {
  stockInLogs: StockInLog[];
  ingredients: Ingredient[];
  requests?: IngredientRequest[];
  batches: StockBatch[];
  currentUserName: string | null;
  onRecordStockIn: (data: StockInPayload) => Promise<boolean>;
  onUpdateBatch: (id: number, data: { batch_code?: string; expiry_date?: string }) => Promise<boolean>;
  onDiscardBatch: (id: number, data: { quantity: number; reason: string; by: string | null }) => Promise<boolean>;
}

export const RecordStockIn: React.FC<RecordStockInProps> = ({
  stockInLogs,
  ingredients,
  requests = [],
  batches,
  currentUserName,
  onRecordStockIn,
  onUpdateBatch,
  onDiscardBatch
}) => {
  const [prefill, setPrefill] = useState<StockInPrefill | null>(null);

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

  // A request has no expiry date, so it fills the form instead of posting straight away.
  const handleReceiveRequest = (req: IngredientRequest) => {
    const ing = ingredients.find((i) => i.id === req.ingredient_id);
    setPrefill({
      key: Date.now(),
      ingredientId: req.ingredient_id,
      quantity: req.quantity,
      cost: ing && ing.cost_per_unit ? (ing.cost_per_unit * req.quantity).toFixed(2) : '',
      supplier: `Staff Req: ${req.staff_name}`,
      invoiceNumber: `REQ-${req.id}`,
      requestId: req.id,
    });
  };

  const handleSubmitted = (done: StockInPrefill | null) => {
    if (done?.requestId) setProcessedIds((prev) => [...prev, done.requestId as number]);
  };

  return (
    <div style={styles.container} className="page-scroll fade-in">
      <div style={styles.layoutGrid}>

        {/* COLUMN 1: Receive stock, batch by batch */}
        <ReceiveStockForm
          ingredients={ingredients}
          batches={batches}
          costRequired
          receivedBy={currentUserName}
          prefill={prefill}
          onSubmit={onRecordStockIn}
          onSubmitted={handleSubmitted}
        />

        {/* COLUMN 2: Approved Stock In Requests Sheet */}
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
                  const isFilling = prefill?.requestId === req.id;

                  return (
                    <div
                      key={req.id}
                      style={{
                        ...styles.approvedCardItem,
                        ...(isFilling ? { borderColor: 'rgba(16, 185, 129, 0.5)' } : {})
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={styles.approvedBadge}>
                          ✓ Approved by Staff
                        </span>
                        <span style={styles.timestampText}>
                          <Clock size={11} style={{ marginRight: '4px' }} />
                          {parseServerTime(req.requested_at)?.toLocaleDateString()}
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

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleReceiveRequest(req)}
                        style={{
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          padding: '8px 12px',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          border: 'none'
                        }}
                        title="Fill the form, then add the expiry date"
                      >
                        <ArrowRight size={14} />
                        <span>{isFilling ? 'Add the expiry date in the form' : 'Receive into stock'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Use-first queue: which batch to open next */}
      <BatchQueue
        batches={batches}
        currentUserName={currentUserName}
        onUpdateBatch={onUpdateBatch}
        onDiscardBatch={onDiscardBatch}
      />

      {/* Recent Shipment Logs Table */}
      <div style={{ ...styles.card, minHeight: 0, maxHeight: 'none' }} className="glass-card">
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
                  <th>Batches &amp; Expiry</th>
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
                        <span>{parseServerTime(log.received_at)?.toLocaleDateString()}</span>
                      </div>
                      {log.received_by && (
                        <span style={{ fontSize: '0.72rem' }}>by {log.received_by}</span>
                      )}
                    </td>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{log.ingredient_name}</td>
                    <td style={{ fontWeight: '700', color: '#10b981' }}>
                      +{formatQty(log.quantity)} {log.ingredient_unit}
                    </td>
                    <td>
                      {log.batches && log.batches.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
                          {log.batches.map((b) => (
                            <span key={b.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <code style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{b.batch_code}</code>
                              {' · '}{formatQty(b.quantity)} {log.ingredient_unit}{' · '}{formatExpiry(b.expiry_date)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not recorded</span>
                      )}
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
  );
};

const styles = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    boxSizing: 'border-box' as const,
    minHeight: 0,
    flex: 1
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
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
