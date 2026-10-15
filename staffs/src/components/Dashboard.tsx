import React from 'react';
import { Box, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import type { Ingredient, Order } from '../types';

interface DashboardProps {
  ingredients: Ingredient[];
  orders: Order[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  ingredients,
  orders,
  loading,
  onRefresh,
}) => {
  // KPI Calculations
  const totalProducts = ingredients.length;
  const lowStockItems = ingredients.filter(i => i.stock_level <= i.reorder_point);
  const lowStockCount = lowStockItems.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;

  return (
    <div style={styles.container} className="fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>DASHBOARD</h2>
          <p style={styles.subtitle}>OVERVIEW OF YOUR BREAK&amp;BREWS OPERATIONS &amp; INVENTORY</p>
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
        <div style={styles.kpiCard} className="group relative transition-all duration-300 ease-out cursor-pointer hover:scale-105 hover:-translate-y-1 hover:shadow-2xl">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>TOTAL PRODUCTS</span>
            <span style={styles.kpiValue}>{totalProducts}</span>
          </div>
          <div style={styles.kpiIconContainer} className="group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <Box size={28} color="#D4A373" />
          </div>
        </div>

        <div style={styles.kpiCard} className="group relative transition-all duration-300 ease-out cursor-pointer hover:scale-105 hover:-translate-y-1 hover:shadow-2xl">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>LOW STOCK ITEMS</span>
            <span style={{ ...styles.kpiValue, color: lowStockCount > 0 ? '#FF4D4D' : '#FFFFFF' }}>
              {lowStockCount}
            </span>
          </div>
          <div style={styles.kpiIconContainer} className="group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <AlertTriangle size={28} color={lowStockCount > 0 ? '#FF4D4D' : '#D4A373'} />
          </div>
        </div>

        <div style={styles.kpiCard} className="group relative transition-all duration-300 ease-out cursor-pointer hover:scale-105 hover:-translate-y-1 hover:shadow-2xl">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>PENDING ORDERS</span>
            <span style={styles.kpiValue}>{pendingOrdersCount}</span>
          </div>
          <div style={styles.kpiIconContainer} className="group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <Clock size={28} color="#D4A373" />
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
    color: '#F8FAFC',
    letterSpacing: '1px',
    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: '#F8FAFC',
    opacity: 0.85,
    fontWeight: '600',
    letterSpacing: '0.5px',
    textShadow: '0 1px 6px rgba(0,0,0,0.4)',
  },
  refreshBtn: {
    height: '42px',
    backgroundColor: 'rgba(12, 12, 15, 0.88)',
    color: '#F8FAFC',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
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
    background: 'rgba(12, 12, 15, 0.88)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
  },
  kpiContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  kpiLabel: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
  },
  kpiValue: {
    fontSize: '2.4rem',
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 1,
  },
  kpiIconContainer: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
