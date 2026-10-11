import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { Ingredient, StockBatch, StockInPayload } from '../types';
import { ReceiveStockForm } from './ReceiveStockForm';
import { BatchQueue } from './BatchQueue';

interface StockAndExpiryProps {
  ingredients: Ingredient[];
  batches: StockBatch[];
  currentUserName: string | null;
  loading: boolean;
  onRefresh: () => void;
  onRecordStockIn: (data: StockInPayload) => Promise<boolean>;
  onUpdateBatch: (id: number, data: { batch_code?: string; expiry_date?: string }) => Promise<boolean>;
  onDiscardBatch: (id: number, data: { quantity: number; reason: string; by: string | null }) => Promise<boolean>;
}

export const StockAndExpiry: React.FC<StockAndExpiryProps> = ({
  ingredients,
  batches,
  currentUserName,
  loading,
  onRefresh,
  onRecordStockIn,
  onUpdateBatch,
  onDiscardBatch,
}) => (
  <div style={styles.container} className="fade-in">
    <div style={styles.header}>
      <div>
        <h2 style={styles.title}>STOCK IN & EXPIRY</h2>
        <p style={styles.subtitle}>RECEIVE DELIVERIES BY BATCH & USE THE SOONEST-EXPIRING FIRST</p>
      </div>
      <button onClick={onRefresh} className="btn btn-secondary" disabled={loading} style={{ height: '42px' }}>
        <RefreshCw size={16} className={loading ? 'spin' : ''} />
        <span>Refresh Data</span>
      </button>
    </div>

    <div style={styles.grid}>
      <ReceiveStockForm
        ingredients={ingredients}
        batches={batches}
        costRequired={false}
        receivedBy={currentUserName}
        onSubmit={onRecordStockIn}
      />
      <BatchQueue
        batches={batches}
        currentUserName={currentUserName}
        onUpdateBatch={onUpdateBatch}
        onDiscardBatch={onDiscardBatch}
      />
    </div>
  </div>
);

const styles = {
  container: { display: 'flex', flexDirection: 'column' as const, gap: '24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' as const },
  title: { margin: 0, fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '1px' },
  subtitle: { margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.5px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
    gap: '24px',
    alignItems: 'start',
  },
};
