import React from 'react';
import { Box, AlertTriangle, Clock, RefreshCw, FileText } from 'lucide-react';
import type { Ingredient, Order, IngredientRequest } from '../types';

interface DashboardProps {
  ingredients: Ingredient[];
  orders: Order[];
  requests?: IngredientRequest[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  ingredients,
  orders,
  requests = [],
  loading,
  onRefresh,
}) => {
  // KPI Calculations
  const totalProducts = ingredients.length;
  const lowStockItems = ingredients.filter(i => i.stock_level <= i.reorder_point);
  const lowStockCount = lowStockItems.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div style={styles.container} className="fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>DASHBOARD</h2>
          <p style={styles.subtitle}>OVERVIEW OF YOUR BREAK&BREWS OPERATIONS & INVENTORY</p>
        </div>
        <button 
          onClick={onRefresh} 
          className="btn btn-secondary" 
          disabled={loading}
          style={styles.refreshBtn}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh Overview</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard} className="card group relative transition-all duration-300 ease-out cursor-pointer hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-950/10">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>TOTAL PRODUCTS</span>
            <span style={styles.kpiValue}>{totalProducts}</span>
          </div>
          <div style={styles.kpiIconContainer} className="group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <Box size={28} color="#4a3f35" />
          </div>
        </div>

        <div style={styles.kpiCard} className="card group relative transition-all duration-300 ease-out cursor-pointer hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-950/10">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>LOW STOCK ITEMS</span>
            <span style={{ ...styles.kpiValue, color: lowStockCount > 0 ? '#ef4444' : 'var(--text-primary)' }}>
              {lowStockCount}
            </span>
          </div>
          <div style={styles.kpiIconContainer} className="group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <AlertTriangle size={28} color={lowStockCount > 0 ? '#ef4444' : '#4a3f35'} />
          </div>
        </div>

        <div style={styles.kpiCard} className="card group relative transition-all duration-300 ease-out cursor-pointer hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-950/10">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>PENDING ORDERS</span>
            <span style={styles.kpiValue}>{pendingOrdersCount}</span>
          </div>
          <div style={styles.kpiIconContainer} className="group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <Clock size={28} color="#4a3f35" />
          </div>
        </div>

        <div style={styles.kpiCard} className="card group relative transition-all duration-300 ease-out cursor-pointer hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-950/10">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>PENDING REQUESTS</span>
            <span style={{ ...styles.kpiValue, color: pendingRequestsCount > 0 ? '#3b82f6' : 'var(--text-primary)' }}>
              {pendingRequestsCount}
            </span>
          </div>
          <div style={styles.kpiIconContainer} className="group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <FileText size={28} color={pendingRequestsCount > 0 ? '#3b82f6' : '#4a3f35'} />
          </div>
        </div>
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
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '24px',
  },
  kpiCard: {
    padding: '24px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative' as const,
    borderBottom: '4px solid var(--border-glass)',
  },
  kpiContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  kpiLabel: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  kpiValue: {
    fontSize: '2.2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    lineHeight: 1,
  },
  kpiIconContainer: {
    width: '52px',
    height: '52px',
    borderRadius: '16px',
    backgroundColor: 'rgba(148, 118, 86, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 2px 4px rgba(148, 118, 86, 0.04)',
  },
  gridSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px',
  },
  navCard: {
    padding: '28px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    gap: '24px',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  navCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  iconCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    backgroundColor: 'rgba(148, 118, 86, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navCardTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  navCardSub: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },
  navCardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-glass)',
  },
  navCardBadge: {
    fontSize: '0.8rem',
    fontWeight: '700',
    padding: '4px 12px',
    borderRadius: '8px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
  },
  navCardLink: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--accent-primary)',
  },
};
