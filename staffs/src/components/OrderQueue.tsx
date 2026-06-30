import React, { useState } from 'react';
import { Check, X, Clock, Filter, RefreshCw } from 'lucide-react';
import type { Order } from '../types';

interface OrderQueueProps {
  orders: Order[];
  onUpdateStatus: (id: number, status: 'completed' | 'cancelled') => void;
  loading: boolean;
  onRefresh: () => void;
}

export const OrderQueue: React.FC<OrderQueueProps> = ({
  orders,
  onUpdateStatus,
  loading,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('pending');

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div style={styles.container} className="fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>ORDER QUEUE</h2>
          <p style={styles.subtitle}>MANAGE AND FULFILL INCOMING CAFE ORDERS</p>
        </div>
        <button 
          onClick={onRefresh} 
          className="btn btn-secondary" 
          disabled={loading}
          style={styles.refreshBtn}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter Tabs & Stats */}
      <div style={styles.controlsRow}>
        <div style={styles.tabs}>
          {(['pending', 'completed', 'cancelled', 'all'] as const).map((tab) => {
            const count = orders.filter(o => tab === 'all' ? true : o.status === tab).length;
            const isActive = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  ...styles.tabBtn,
                  backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                <span style={styles.tabLabel}>{tab.toUpperCase()}</span>
                <span style={{
                  ...styles.tabBadge,
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'var(--accent-light)',
                  color: isActive ? '#ffffff' : 'var(--accent-primary)',
                }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Grid */}
      <div style={styles.ordersGrid}>
        {filteredOrders.map((order) => (
          <div key={order.id} style={styles.orderTicket} className="card">
            {/* Ticket Header */}
            <div style={{
              ...styles.ticketHeader,
              borderLeft: `5px solid ${
                order.status === 'pending' ? 'var(--warning)' : 
                order.status === 'completed' ? 'var(--success)' : 'var(--danger)'
              }`
            }}>
              <div style={styles.ticketMeta}>
                <span style={styles.orderNumber}>Order #{order.id}</span>
                <div style={styles.timeTag}>
                  <Clock size={14} color="var(--text-muted)" />
                  <span style={styles.timeText}>{formatTime(order.created_at)}</span>
                  <span style={styles.dateText}>({formatDate(order.created_at)})</span>
                </div>
              </div>
              <span className={`badge-pill badge-${order.status}`} style={styles.statusBadge}>
                {order.status}
              </span>
            </div>

            {/* Ticket Items */}
            <div style={styles.ticketBody}>
              <div style={styles.itemsList}>
                {order.items.map((item) => (
                  <div key={item.id} style={styles.itemRow}>
                    <div style={styles.itemNameCol}>
                      <span style={styles.itemQty}>{item.quantity}x</span>
                      <span style={styles.itemName}>{item.menu_item_name}</span>
                    </div>
                    <span style={styles.itemPrice}>${(item.price_at_order * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Dashed Divider */}
              <div style={styles.dashedDivider}></div>

              {/* Ticket Total */}
              <div style={styles.totalRow}>
                <span style={styles.totalLabel}>TOTAL</span>
                <span style={styles.totalVal}>${order.total_amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Ticket Actions */}
            {order.status === 'pending' && (
              <div style={styles.ticketActions}>
                <button
                  onClick={() => onUpdateStatus(order.id, 'cancelled')}
                  style={{ ...styles.actionBtn, ...styles.cancelBtn }}
                  title="Cancel Order"
                >
                  <X size={18} />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={() => onUpdateStatus(order.id, 'completed')}
                  style={{ ...styles.actionBtn, ...styles.completeBtn }}
                  title="Complete Order"
                >
                  <Check size={18} />
                  <span>Complete</span>
                </button>
              </div>
            )}
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div style={styles.emptyState} className="card">
            <Filter size={48} color="var(--text-muted)" style={{ opacity: 0.5 }} />
            <h3 style={styles.emptyStateTitle}>No {filter} orders found</h3>
            <p style={styles.emptyStateText}>Active orders placed at the POS will appear here in real-time.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '32px',
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
  refreshBtn: {
    height: '42px',
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border-glass)',
    paddingBottom: '16px',
  },
  tabs: {
    display: 'flex',
    gap: '12px',
    backgroundColor: '#eae1d4',
    padding: '6px',
    borderRadius: '16px',
  },
  tabBtn: {
    border: 'none',
    borderRadius: '12px',
    padding: '8px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  },
  tabLabel: {
    fontSize: '0.8rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  tabBadge: {
    fontSize: '0.75rem',
    fontWeight: '800',
    padding: '2px 6px',
    borderRadius: '6px',
  },
  ordersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '24px',
    alignItems: 'start',
  },
  orderTicket: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '280px',
    backgroundColor: '#ffffff',
    position: 'relative' as const,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 12px 35px rgba(148, 118, 86, 0.12)',
    },
  },
  ticketHeader: {
    padding: '20px 24px',
    backgroundColor: '#faf8f5',
    borderBottom: '1px solid var(--border-glass)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticketMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  orderNumber: {
    fontSize: '1.15rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  timeTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  timeText: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  dateText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  statusBadge: {
    fontSize: '0.75rem',
  },
  ticketBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    flex: 1,
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemNameCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  itemQty: {
    fontSize: '0.85rem',
    fontWeight: '800',
    color: 'var(--accent-primary)',
    backgroundColor: 'var(--accent-light)',
    padding: '2px 6px',
    borderRadius: '6px',
  },
  itemName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  itemPrice: {
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
  dashedDivider: {
    width: '100%',
    height: '1px',
    borderBottom: '2px dashed var(--border-glass)',
    margin: '20px 0',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: '0.85rem',
    fontWeight: '800',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  totalVal: {
    fontSize: '1.3rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  ticketActions: {
    display: 'flex',
    borderTop: '1px solid var(--border-glass)',
    backgroundColor: '#faf8f5',
  },
  actionBtn: {
    flex: 1,
    padding: '14px 0',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '0.85rem',
    fontWeight: '700',
    fontFamily: 'inherit',
    transition: 'background-color 0.2s ease',
  },
  cancelBtn: {
    color: 'var(--danger)',
    borderRight: '1px solid var(--border-glass)',
    ':hover': {
      backgroundColor: 'var(--danger-bg)',
    },
  },
  completeBtn: {
    color: 'var(--success)',
    ':hover': {
      backgroundColor: 'var(--success-bg)',
    },
  },
  emptyState: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 40px',
    textAlign: 'center' as const,
    backgroundColor: '#ffffff',
    gap: '16px',
  },
  emptyStateTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  emptyStateText: {
    margin: 0,
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    maxWidth: '320px',
  },
};
