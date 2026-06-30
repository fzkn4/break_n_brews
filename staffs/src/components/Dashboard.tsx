import React from 'react';
import { Box, AlertTriangle, Clock, TrendingDown, RefreshCw } from 'lucide-react';
import type { Ingredient, Order } from '../types';

interface DashboardProps {
  ingredients: Ingredient[];
  orders: Order[];
  loading: boolean;
  onRefresh: () => void;
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
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

  // Inventory predictions: Sort all ingredients by stock level relative to reorder point
  // to show the most critical ones at the top, limit to Top 5.
  const predictionItems = [...ingredients]
    .sort((a, b) => {
      const ratioA = a.stock_level / a.reorder_point;
      const ratioB = b.stock_level / b.reorder_point;
      return ratioA - ratioB;
    })
    .slice(0, 5);

  const getPredictionDetails = (item: Ingredient) => {
    const ratio = item.stock_level / item.reorder_point;
    let status: 'critical' | 'warning' | 'low' | 'normal' = 'normal';
    let estDaysLeft = 15;
    let suggestedAction = 'Maintain';

    if (item.stock_level === 0) {
      status = 'critical';
      estDaysLeft = 0;
      suggestedAction = 'Contact Supplier';
    } else if (ratio <= 0.4) {
      status = 'critical';
      estDaysLeft = Math.max(1, Math.ceil(ratio * 10));
      suggestedAction = 'Contact Supplier';
    } else if (ratio <= 0.7) {
      status = 'warning';
      estDaysLeft = Math.max(2, Math.ceil(ratio * 10));
      suggestedAction = 'Monitor';
    } else if (ratio <= 1.0) {
      status = 'low';
      estDaysLeft = Math.max(5, Math.ceil(ratio * 12));
      suggestedAction = 'Monitor';
    } else {
      status = 'normal';
      estDaysLeft = Math.ceil(ratio * 15);
      suggestedAction = 'Maintain';
    }

    return { status, estDaysLeft, suggestedAction };
  };

  return (
    <div style={styles.container} className="fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>DASHBOARD</h2>
          <p style={styles.subtitle}>OVERVIEW OF YOUR BREAK&BREWS INVENTORY</p>
        </div>
        <button 
          onClick={onRefresh} 
          className="btn btn-secondary" 
          disabled={loading}
          style={styles.refreshBtn}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard} className="card">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>TOTAL PRODUCT</span>
            <span style={styles.kpiValue}>{totalProducts}</span>
          </div>
          <div style={styles.kpiIconContainer}>
            <Box size={28} color="#4a3f35" />
          </div>
        </div>

        <div style={styles.kpiCard} className="card">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>LOW STOCK ITEMS</span>
            <span style={styles.kpiValue}>{lowStockCount}</span>
          </div>
          <div style={styles.kpiIconContainer}>
            <AlertTriangle size={28} color="#4a3f35" />
          </div>
        </div>

        <div style={styles.kpiCard} className="card">
          <div style={styles.kpiContent}>
            <span style={styles.kpiLabel}>PENDING ORDERS</span>
            <span style={styles.kpiValue}>{pendingOrdersCount}</span>
          </div>
          <div style={styles.kpiIconContainer}>
            <Clock size={28} color="#4a3f35" />
          </div>
        </div>
      </div>

      {/* Prediction Table Card */}
      <div style={styles.tableCard} className="card">
        <div style={styles.tableHeader}>
          <h3 style={styles.tableHeaderTitle}>Inventory Alert & Prediction</h3>
          <p style={styles.tableHeaderSubtitle}>Critical stock levels and smart predictions (Top 5)</p>
        </div>

        <div style={styles.tableResponsive}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}></th>
                <th style={styles.th}>Ingredient Name</th>
                <th style={styles.th}>Current Stock</th>
                <th style={styles.th}>Minimum Stock</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Est. Days Left</th>
                <th style={styles.th}>Suggested Action</th>
              </tr>
            </thead>
            <tbody>
              {predictionItems.map((item) => {
                const { status, estDaysLeft, suggestedAction } = getPredictionDetails(item);
                return (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>
                      <TrendingDown size={18} color="var(--danger)" />
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{item.name}</td>
                    <td style={styles.td}>{item.stock_level} {item.unit}</td>
                    <td style={styles.td}>{item.reorder_point} {item.unit}</td>
                    <td style={styles.td}>
                      <span className={`badge-pill badge-${status}`}>
                        {status}
                      </span>
                    </td>
                    <td style={{ 
                      ...styles.td, 
                      color: status === 'critical' ? 'var(--danger)' : status === 'warning' ? 'var(--warning)' : '#ca8a04',
                      fontWeight: 600
                    }}>
                      {estDaysLeft === 0 ? 'Out of stock' : `${estDaysLeft} days`}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.actionBadge,
                        backgroundColor: suggestedAction === 'Contact Supplier' ? '#fffbeb' : 'var(--bg-primary)',
                        color: 'var(--accent-primary)',
                        border: '1px solid var(--border-glass)'
                      }}>
                        {suggestedAction}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {predictionItems.length === 0 && (
                <tr>
                  <td colSpan={7} style={styles.emptyTd}>
                    All inventory levels are optimal. No predictions to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.tableFooter}>
          <p style={styles.tableFooterText}>
            Supplier delivery typically takes 3-5 days. Plan accordingly for critical items.
          </p>
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
  },
  kpiCard: {
    padding: '30px',
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
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.5px',
  },
  kpiValue: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    lineHeight: 1,
  },
  kpiIconContainer: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    backgroundColor: 'rgba(148, 118, 86, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 2px 4px rgba(148, 118, 86, 0.04)',
  },
  tableCard: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  tableHeader: {
    backgroundColor: 'var(--accent-primary)',
    padding: '24px 32px',
    color: '#ffffff',
  },
  tableHeaderTitle: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  tableHeaderSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  tableResponsive: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    textAlign: 'left' as const,
  },
  th: {
    padding: '16px 32px',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border-glass)',
    backgroundColor: '#faf8f5',
  },
  tr: {
    borderBottom: '1px solid var(--border-glass)',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#fdfcfb',
    },
  },
  td: {
    padding: '20px 32px',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    verticalAlign: 'middle',
  },
  emptyTd: {
    padding: '40px',
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
  },
  actionBadge: {
    padding: '6px 14px',
    borderRadius: '100px',
    fontSize: '0.8rem',
    fontWeight: '700',
    display: 'inline-block',
  },
  tableFooter: {
    padding: '20px 32px',
    backgroundColor: '#faf8f5',
    borderTop: '1px solid var(--border-glass)',
  },
  tableFooterText: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
};
