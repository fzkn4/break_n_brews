import React, { useEffect } from 'react';
import { List, Calendar } from 'lucide-react';
import type { StockInLog, Ingredient, StockBatch, StockInPayload } from '../types';
import { ReceiveStockForm } from './ReceiveStockForm';
import { BatchQueue } from './BatchQueue';
import { formatExpiry, formatQty, parseServerTime } from '../lib/expiry';

interface RecordStockInProps {
  stockInLogs: StockInLog[];
  ingredients: Ingredient[];
  batches: StockBatch[];
  currentUserName: string | null;
  onRecordStockIn: (data: StockInPayload) => Promise<boolean>;
  onUpdateBatch: (id: number, data: { batch_code?: string; expiry_date?: string }) => Promise<boolean>;
  onDiscardBatch: (id: number, data: { quantity: number; reason: string; by: string | null }) => Promise<boolean>;
  onCreateIngredient?: (data: any) => Promise<Ingredient | null>;
}

export const RecordStockIn: React.FC<RecordStockInProps> = ({
  stockInLogs,
  ingredients,
  batches,
  currentUserName,
  onRecordStockIn,
  onUpdateBatch,
  onDiscardBatch,
  onCreateIngredient,
}) => {
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

  return (
    <div style={styles.container} className="page-scroll fade-in">
      {/* Full-Width Vertical Stack: Top Section = Stock In Form, Bottom Section = Use-First Queue */}
      <div style={styles.verticalStack}>
        <ReceiveStockForm
          ingredients={ingredients}
          batches={batches}
          costRequired
          receivedBy={currentUserName}
          onSubmit={onRecordStockIn}
          onCreateIngredient={onCreateIngredient}
        />

        <BatchQueue
          batches={batches}
          currentUserName={currentUserName}
          onUpdateBatch={onUpdateBatch}
          onDiscardBatch={onDiscardBatch}
        />
      </div>

      {/* Recent Shipment Logs Table underneath 2-column layout */}
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
    flex: 1,
  },
  verticalStack: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    width: '100%',
  },
  card: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const,
    background: '#121212',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    maxHeight: 'calc(100vh - 160px)',
    minHeight: '480px',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '16px',
    marginBottom: '20px',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerDesc: {
    fontSize: '0.75rem',
    color: '#94A3B8',
  },
  tableContainer: {
    overflowY: 'auto' as const,
    minHeight: 0,
    flex: 1,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '220px',
    color: '#94A3B8',
    fontSize: '0.85rem',
    fontStyle: 'italic',
    textAlign: 'center' as const,
  },
};
