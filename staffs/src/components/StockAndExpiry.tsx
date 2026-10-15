import React, { useEffect } from 'react';
import { RefreshCw, List, Calendar } from 'lucide-react';
import type { Ingredient, StockBatch, StockInPayload, StockInLog } from '../types';
import { ReceiveStockForm } from './ReceiveStockForm';
import { BatchQueue } from './BatchQueue';
import { formatExpiry, formatQty, parseServerTime } from '../lib/expiry';

interface StockAndExpiryProps {
  ingredients: Ingredient[];
  batches: StockBatch[];
  stockInLogs?: StockInLog[];
  currentUserName: string | null;
  loading: boolean;
  onRefresh: () => void;
  onRecordStockIn: (data: StockInPayload) => Promise<boolean>;
  onUpdateBatch: (id: number, data: { batch_code?: string; expiry_date?: string }) => Promise<boolean>;
  onDiscardBatch: (id: number, data: { quantity: number; reason: string; by: string | null }) => Promise<boolean>;
  onCreateIngredient?: (data: any) => Promise<Ingredient | null>;
}

export const StockAndExpiry: React.FC<StockAndExpiryProps> = ({
  ingredients,
  batches,
  stockInLogs = [],
  currentUserName,
  loading,
  onRefresh,
  onRecordStockIn,
  onUpdateBatch,
  onDiscardBatch,
  onCreateIngredient,
}) => {
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
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>STOCK IN & EXPIRY</h2>
          <p style={styles.subtitle}>STOCK IN DELIVERIES BY BATCH &amp; USE THE SOONEST-EXPIRING FIRST</p>
        </div>
        <button onClick={onRefresh} className="btn btn-secondary" disabled={loading} style={styles.refreshBtn}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Full-Width Vertical Stack: Top Section = Stock In Form, Bottom Section = Use-First Queue */}
      <div style={styles.verticalStack}>
        <ReceiveStockForm
          ingredients={ingredients}
          batches={batches}
          costRequired={false}
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
                    <td style={{ fontWeight: '600', color: '#FFFFFF' }}>{log.ingredient_name}</td>
                    <td style={{ fontWeight: '700', color: '#10b981' }}>
                      +{formatQty(log.quantity)} {log.ingredient_unit}
                    </td>
                    <td>
                      {log.batches && log.batches.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
                          {log.batches.map((b) => (
                            <span key={b.id} style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                              <code style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#FFFFFF' }}>{b.batch_code}</code>
                              {' · '}{formatQty(b.quantity)} {log.ingredient_unit}{' · '}{formatExpiry(b.expiry_date)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Not recorded</span>
                      )}
                    </td>
                    <td style={{ fontWeight: '600', color: '#FFFFFF' }}>
                      ₱{log.cost.toFixed(2)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                        <span style={{ fontWeight: '500', color: '#FFFFFF' }}>{log.supplier}</span>
                        {log.invoice_number && (
                          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
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
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    boxSizing: 'border-box' as const,
    minHeight: 0,
    flex: 1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap' as const,
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
  refreshBtn: {
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
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
