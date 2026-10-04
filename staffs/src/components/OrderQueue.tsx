import React, { useState } from 'react';
import { 
  Play, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  RefreshCw,
  Info
} from 'lucide-react';
import type { Order, Ingredient } from '../types';

function guestLine(order: { table_label?: string | null; customer_name?: string | null; channel?: string | null }): string | null {
  const parts: string[] = [];
  if (order.table_label) parts.push(`Table ${order.table_label}`);
  if (order.customer_name) parts.push(order.customer_name);
  if (order.channel === 'qr') parts.push('QR order');
  return parts.length ? parts.join(' · ') : null;
}

interface OrderQueueProps {
  orders: Order[];
  ingredients: Ingredient[];
  menuItems: any[];
  onUpdateStatus: (id: number, status: 'preparing' | 'completed' | 'cancelled') => void;
  onRecordSale?: any;
  onRequestIngredient?: any;
  loading: boolean;
  onRefresh: () => void;
}

export const OrderQueue: React.FC<OrderQueueProps> = ({
  orders,
  onUpdateStatus,
  loading,
  onRefresh,
}) => {
  // Order Queue States
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');

  const [activePendingIndex, setActivePendingIndex] = useState(0);

  // Handle cycle through pending stack
  const handleNextPending = () => {
    if (pendingOrders.length > 0) {
      setActivePendingIndex((prev) => (prev + 1) % pendingOrders.length);
    }
  };

  const handlePrevPending = () => {
    if (pendingOrders.length > 0) {
      setActivePendingIndex((prev) => (prev - 1 + pendingOrders.length) % pendingOrders.length);
    }
  };

  // Helper to format order items string
  const getOrderItemsString = (order: Order) => {
    if (!order.items || order.items.length === 0) return 'No items';
    return order.items.map(i => {
      let label = `${i.quantity}x ${i.menu_item_name || 'Item'}`;
      if (i.size) label += ` · ${i.size}`;
      if (i.customizations) {
        try {
          const parsed = typeof i.customizations === 'string' ? JSON.parse(i.customizations) : i.customizations;
          if (Array.isArray(parsed) && parsed.length > 0) {
            const custStrs = parsed.map((c: any) => `${c.name}: ${c.level}`).join(', ');
            label += ` (${custStrs})`;
          }
        } catch(e) {}
      }
      return label;
    }).join(' | ');
  };

  return (
    <div className="order-queue-view">
      {/* View Header */}
      <div style={styles.viewHeader}>
        <div>
          <h1 style={styles.viewTitle}>ORDER QUEUE</h1>
          <p style={styles.viewSubtitle}>MANAGE INCOMING CUSTOMER ORDERS AND PREPARE COFFEE</p>
        </div>
        <button onClick={onRefresh} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Top Section: Active Queue & Preparation */}
      <div style={styles.queueGrid}>
        
        {/* PREPARING COLUMN */}
        <div style={styles.queueColumn}>
          <h2 style={styles.columnHeader}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Preparing 
              <span style={styles.badgeCount}>{preparingOrders.length}</span>
            </span>
          </h2>

          <div style={styles.preparingList}>
            {preparingOrders.length === 0 ? (
              <div style={styles.emptyState}>
                <Info size={24} color="var(--text-muted)" />
                <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No orders are currently being prepared.
                </p>
              </div>
            ) : (
              preparingOrders.map(order => (
                <div key={order.id} className="glass-card" style={styles.orderCard}>
                  {/* Ticket Header */}
                  <div style={styles.cardHeaderPreparing}>
                    <div>
                      <h3 style={styles.cardItemName}>
                        {order.items && order.items[0]?.menu_item_name || 'Custom Brew'}
                      </h3>
                      {guestLine(order) && (
                        <span style={{ display: 'block', marginTop: 4, fontSize: '0.82rem', fontWeight: 700 }}>
                          {guestLine(order)}
                        </span>
                      )}
                      <span style={styles.cardQuantity}>Quantity: {order.items && order.items[0]?.quantity || 1}</span>
                    </div>
                    <div style={styles.statusPreparing}>
                      <span className="pulse-dot-preparing"></span>
                      Preparing
                    </div>
                  </div>

                  {/* Ticket Body */}
                  <div style={styles.cardBody}>
                    <p style={styles.sectionLabel}>Customizations:</p>
                    <p style={styles.customizationsText}>{getOrderItemsString(order)}</p>
                    
                    <span style={styles.orderIdText}>Order #{17785000 + order.id}</span>
                  </div>

                  {/* Ticket Actions */}
                  <div style={styles.cardActionsSingle}>
                    <button 
                      onClick={() => onUpdateStatus(order.id, 'completed')} 
                      className="btn" 
                      style={styles.btnDone}
                    >
                      <Check size={16} />
                      Mark as Done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PENDING COLUMN (STACKED DECK EFFECT!) */}
        <div style={styles.queueColumn}>
          <h2 style={styles.columnHeader}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Pending Queue
              <span style={styles.badgeCount}>{pendingOrders.length}</span>
            </span>
          </h2>

          <div style={styles.stackContainer}>
            {pendingOrders.length === 0 ? (
              <div style={styles.emptyState}>
                <Info size={24} color="var(--text-muted)" />
                <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  All orders completed! Waiting for new tickets...
                </p>
              </div>
            ) : (
              <div style={styles.deckWrapper}>
                {/* Visual Stacked Cards Effect */}
                {pendingOrders.map((order, index) => {
                  // Only render the active one and up to 2 cards behind it
                  const relativeIndex = (index - activePendingIndex + pendingOrders.length) % pendingOrders.length;
                  if (relativeIndex > 2) return null;

                  // Define styling offsets for 3D stack look
                  let transform = 'translate(0, 0) scale(1)';
                  let zIndex = 10 - relativeIndex;
                  let opacity = 1;
                  let pointerEvents: 'auto' | 'none' = 'auto';

                  if (relativeIndex === 1) {
                    transform = 'translate(12px, 12px) scale(0.97)';
                    opacity = 0.85;
                    pointerEvents = 'none';
                  } else if (relativeIndex === 2) {
                    transform = 'translate(24px, 24px) scale(0.94)';
                    opacity = 0.6;
                    pointerEvents = 'none';
                  }

                  return (
                    <div 
                      key={order.id} 
                      className="glass-card" 
                      style={{
                        ...styles.orderCard,
                        ...styles.stackedCard,
                        transform,
                        zIndex,
                        opacity,
                        pointerEvents
                      }}
                    >
                      {/* Ticket Header */}
                      <div style={styles.cardHeaderPending}>
                        <div>
                          <h3 style={styles.cardItemName}>
                            {order.items && order.items[0]?.menu_item_name || 'Pending Brew'}
                          </h3>
                          {guestLine(order) && (
                            <span style={{ display: 'block', marginTop: 4, fontSize: '0.82rem', fontWeight: 700 }}>
                              {guestLine(order)}
                            </span>
                          )}
                          <span style={styles.cardQuantity}>Quantity: {order.items && order.items[0]?.quantity || 1}</span>
                        </div>
                        <div style={styles.statusPending}>
                          Pending
                        </div>
                      </div>

                      {/* Ticket Body */}
                      <div style={styles.cardBody}>
                        <p style={styles.sectionLabel}>Customizations:</p>
                        <p style={styles.customizationsText}>{getOrderItemsString(order)}</p>
                        
                        <span style={styles.orderIdText}>Order #{17785000 + order.id}</span>
                      </div>

                      {/* Ticket Actions */}
                      <div style={styles.cardActionsSingle}>
                        <button 
                          onClick={() => onUpdateStatus(order.id, 'preparing')} 
                          className="btn" 
                          style={styles.btnStart}
                        >
                          <Play size={16} fill="currentColor" />
                          Start Preparing
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Stack Navigation Controls */}
                {pendingOrders.length > 1 && (
                  <div style={styles.stackControls}>
                    <button onClick={handlePrevPending} style={styles.controlBtn}>
                      <ChevronLeft size={20} />
                    </button>
                    <span style={styles.controlLabel}>
                      {activePendingIndex + 1} of {pendingOrders.length}
                    </span>
                    <button onClick={handleNextPending} style={styles.controlBtn}>
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

const styles = {
  viewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px'
  },
  viewTitle: {
    fontSize: '2rem',
    fontWeight: '800',
    color: 'var(--primary-brown)',
    letterSpacing: '-0.02em',
    margin: 0
  },
  viewSubtitle: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginTop: '4px',
    textTransform: 'uppercase' as const
  },
  queueGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '32px',
    alignItems: 'start'
  },
  queueColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px'
  },
  columnHeader: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--primary-brown)',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '8px',
    borderBottom: '2px solid rgba(139, 90, 43, 0.1)'
  },
  badgeCount: {
    fontSize: '0.75rem',
    fontWeight: '700',
    backgroundColor: 'rgba(139, 90, 43, 0.15)',
    color: 'var(--primary-brown)',
    padding: '2px 8px',
    borderRadius: '12px'
  },
  preparingList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    minHeight: '260px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    border: '2px dashed var(--sidebar-border)',
    borderRadius: '16px',
    textAlign: 'center' as const,
    backgroundColor: 'rgba(245, 239, 230, 0.3)'
  },
  orderCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: 0,
    overflow: 'hidden',
    border: '1px solid var(--sidebar-border)',
    boxShadow: '0 8px 24px rgba(139, 90, 43, 0.05)',
    backgroundColor: '#fff',
    borderRadius: '20px'
  },
  cardHeaderPreparing: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    backgroundColor: 'var(--card-header-preparing)',
    borderBottom: '1px dashed var(--sidebar-border)'
  },
  cardHeaderPending: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    backgroundColor: 'var(--card-header-pending)',
    borderBottom: '1px dashed var(--sidebar-border)'
  },
  cardItemName: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#fff',
    margin: 0
  },
  cardQuantity: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: '2px',
    display: 'inline-block'
  },
  statusPreparing: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#fff'
  },
  statusPending: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: '4px 10px',
    borderRadius: '20px'
  },
  cardBody: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  sectionLabel: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    margin: 0
  },
  customizationsText: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: 'var(--primary-brown)',
    margin: 0
  },
  orderIdText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '4px'
  },
  cardActions: {
    padding: '0 24px 24px 24px',
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '12px'
  },
  cardActionsSingle: {
    padding: '0 24px 24px 24px'
  },
  btnRequest: {
    backgroundColor: 'var(--card-btn-request-bg)',
    border: 'none',
    color: 'var(--card-btn-request-text)',
    padding: '12px 14px',
    fontSize: '0.85rem',
    fontWeight: '700',
    borderRadius: '12px',
    justifyContent: 'center',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  btnDone: {
    backgroundColor: 'var(--card-btn-done)',
    border: 'none',
    color: '#fff',
    padding: '12px 14px',
    fontSize: '0.85rem',
    fontWeight: '700',
    borderRadius: '12px',
    justifyContent: 'center',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  btnStart: {
    backgroundColor: 'var(--card-btn-start)',
    border: 'none',
    color: '#fff',
    padding: '12px 14px',
    fontSize: '0.9rem',
    fontWeight: '700',
    borderRadius: '12px',
    justifyContent: 'center',
    width: '100%',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  stackContainer: {
    position: 'relative' as const,
    minHeight: '320px',
    display: 'flex',
    flexDirection: 'column' as const
  },
  deckWrapper: {
    position: 'relative' as const,
    width: '100%',
    flex: 1,
    paddingBottom: '60px'
  },
  stackedCard: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease'
  },
  stackControls: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '20px'
  },
  controlBtn: {
    background: '#fff',
    border: '1px solid var(--sidebar-border)',
    color: 'var(--primary-brown)',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(139, 90, 43, 0.05)'
  },
  controlLabel: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--primary-brown)'
  },
  sectionDivider: {
    border: 'none',
    borderTop: '1px solid var(--sidebar-border)',
    margin: '48px 0 24px 0'
  },
  processTitle: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--primary-brown)',
    letterSpacing: '-0.02em',
    marginBottom: '24px'
  },
  processGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '32px',
    alignItems: 'stretch'
  },
  formTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--sidebar-border)'
  },
  iconCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  formTitle: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: 'var(--primary-brown)',
    margin: 0
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--primary-brown)'
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1.5px solid var(--sidebar-border)',
    backgroundColor: '#fff',
    color: 'var(--primary-brown)',
    fontSize: '0.95rem',
    fontWeight: '500',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box' as const
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1.5px solid var(--sidebar-border)',
    backgroundColor: '#fff',
    color: 'var(--primary-brown)',
    fontSize: '0.95rem',
    fontWeight: '500',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box' as const
  },
  checkboxContainer: {
    display: 'flex',
    alignItems: 'center',
    margin: '4px 0'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: 'var(--primary-brown)',
    cursor: 'pointer'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: 'var(--primary-brown)'
  },
  btnRecord: {
    backgroundColor: 'var(--accent-primary)',
    color: '#fff',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    fontSize: '0.95rem',
    fontWeight: '700',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(139, 90, 43, 0.1)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  impactPlaceholder: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: '200px',
    textAlign: 'center' as const
  },
  bowlIllustration: {
    marginBottom: '16px',
    opacity: 0.8
  },
  placeholderText: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    maxWidth: '240px',
    lineHeight: '1.5',
    margin: 0
  },
  impactList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    marginBottom: '20px'
  },
  impactRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--sidebar-border)',
    borderRadius: '12px'
  },
  impactIngName: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: 'var(--primary-brown)',
    margin: 0
  },
  impactDetail: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
    margin: 0
  },
  impactBadge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '4px 8px',
    borderRadius: '6px'
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '600'
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: '#10b981',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: '600'
  },

  // Modal Styles
  modalOverlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 5, 8, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 2000
  },
  modalContent: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(139, 90, 43, 0.15)',
    border: '1px solid var(--sidebar-border)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid var(--sidebar-border)',
    backgroundColor: 'var(--bg-primary)'
  },
  modalTitle: {
    fontSize: '1.15rem',
    fontWeight: '800',
    color: 'var(--primary-brown)',
    margin: 0
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'background-color 0.2s'
  },
  textarea: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1.5px solid var(--sidebar-border)',
    backgroundColor: '#fff',
    color: 'var(--primary-brown)',
    fontSize: '0.95rem',
    fontWeight: '500',
    outline: 'none',
    transition: 'border-color 0.2s',
    resize: 'none' as const,
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px'
  }
};
