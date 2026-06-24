import React, { useState, useEffect } from 'react';
import { FileText, Printer } from 'lucide-react';
import type { ReportData } from '../types';

interface ReportsProps {
  onFetchReports: () => Promise<ReportData | null>;
}

export const Reports: React.FC<ReportsProps> = ({ onFetchReports }) => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'health' | 'suppliers' | 'sales'>('health');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadReports = async () => {
      if (!reportData) {
        setLoading(true);
      }
      const data = await onFetchReports();
      if (data) setReportData(data);
      setLoading(false);
    };
    loadReports();
  }, [onFetchReports]);

  if (loading || !reportData) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <span style={{ marginTop: '12px', color: '#9ca3af' }}>Compiling operations audit report...</span>
      </div>
    );
  }

  const { inventory_health, supplier_summary, sales_breakdown } = reportData;

  // Calculations for total valuations
  const totalStockValuation = inventory_health.reduce((sum, item) => sum + item.cost_value, 0);
  const totalSupplierSpend = supplier_summary.reduce((sum, item) => sum + item.total_spent, 0);
  const totalMenuSales = sales_breakdown.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div style={styles.container} className="fade-in">
      
      {/* Reports Navigation Sub-bar */}
      <div style={styles.header}>
        <div style={styles.tabButtons}>
          <button
            onClick={() => setActiveSubTab('health')}
            className={`btn ${activeSubTab === 'health' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Inventory Valuation & Health
          </button>
          <button
            onClick={() => setActiveSubTab('suppliers')}
            className={`btn ${activeSubTab === 'suppliers' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Supplier Spend Audit
          </button>
          <button
            onClick={() => setActiveSubTab('sales')}
            className={`btn ${activeSubTab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Menu Product Performance
          </button>
        </div>

        <button 
          onClick={() => window.print()} 
          className="btn btn-secondary"
          style={{ gap: '8px', padding: '8px 16px' }}
        >
          <Printer size={16} />
          <span>Print Report</span>
        </button>
      </div>

      {/* SUB-TAB 1: INVENTORY HEALTH */}
      {activeSubTab === 'health' && (
        <div style={styles.reportArea} className="fade-in">
          {/* Summary Box */}
          <div style={styles.summaryCard} className="glass-card">
            <div style={styles.summaryRow}>
              <div style={styles.summaryCol}>
                <span style={styles.summaryLabel}>Total Stock Valuation</span>
                <span style={styles.summaryVal}>${totalStockValuation.toFixed(2)}</span>
              </div>
              <div style={styles.summaryDivider}></div>
              <div style={styles.summaryCol}>
                <span style={styles.summaryLabel}>Low Stock Items</span>
                <span style={{ 
                  ...styles.summaryVal, 
                  color: inventory_health.filter(i => i.status !== 'Normal').length > 0 ? '#f59e0b' : '#10b981' 
                }}>
                  {inventory_health.filter(i => i.status !== 'Normal').length} Alerts
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Valuation Table */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={styles.tableHeader}>
              <FileText size={18} color="#f59e0b" />
              <h4 style={styles.tableTitle}>Stock Valuation Sheets</h4>
            </div>
            <table className="crud-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ingredient Name</th>
                  <th>Category</th>
                  <th>Stock Quantity</th>
                  <th>Reorder Level</th>
                  <th>Valuation Cost Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory_health.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.name}</td>
                    <td>{item.category}</td>
                    <td style={{ fontWeight: '700' }}>{item.stock_level} {item.unit}</td>
                    <td style={{ color: '#9ca3af' }}>{item.reorder_point} {item.unit}</td>
                    <td style={{ fontWeight: '600', color: '#10b981' }}>${item.cost_value.toFixed(2)}</td>
                    <td>
                      {item.status === 'Out of Stock' ? (
                        <span style={styles.badgeRed}>OUT OF STOCK</span>
                      ) : item.status === 'Low Stock' ? (
                        <span style={styles.badgeOrange}>LOW STOCK</span>
                      ) : (
                        <span style={styles.badgeGreen}>NORMAL</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SUPPLIER SPEND */}
      {activeSubTab === 'suppliers' && (
        <div style={styles.reportArea} className="fade-in">
          {/* Summary Box */}
          <div style={styles.summaryCard} className="glass-card">
            <div style={styles.summaryRow}>
              <div style={styles.summaryCol}>
                <span style={styles.summaryLabel}>Total Vendor Spendings</span>
                <span style={styles.summaryVal}>${totalSupplierSpend.toFixed(2)}</span>
              </div>
              <div style={styles.summaryDivider}></div>
              <div style={styles.summaryCol}>
                <span style={styles.summaryLabel}>Active Suppliers</span>
                <span style={styles.summaryVal}>{supplier_summary.length} Vendors</span>
              </div>
            </div>
          </div>

          {/* Supplier Spend Table */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={styles.tableHeader}>
              <FileText size={18} color="#3b82f6" />
              <h4 style={styles.tableTitle}>Supplier Restock Expense ledger</h4>
            </div>
            <table className="crud-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Vendor / Supplier Name</th>
                  <th>Shipments Logged</th>
                  <th>Total Spent (Cumulative)</th>
                </tr>
              </thead>
              <tbody>
                {supplier_summary.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                      No supplier check-in logs found.
                    </td>
                  </tr>
                ) : (
                  supplier_summary.map((sup, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{sup.supplier}</td>
                      <td>{sup.shipments_count} shipments</td>
                      <td style={{ fontWeight: '700', color: '#f59e0b' }}>${sup.total_spent.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MENU PERFORMANCE */}
      {activeSubTab === 'sales' && (
        <div style={styles.reportArea} className="fade-in">
          {/* Summary Box */}
          <div style={styles.summaryCard} className="glass-card">
            <div style={styles.summaryRow}>
              <div style={styles.summaryCol}>
                <span style={styles.summaryLabel}>Total Menu Sales Revenue</span>
                <span style={styles.summaryVal}>${totalMenuSales.toFixed(2)}</span>
              </div>
              <div style={styles.summaryDivider}></div>
              <div style={styles.summaryCol}>
                <span style={styles.summaryLabel}>Catalog Sold Items</span>
                <span style={styles.summaryVal}>{sales_breakdown.length} Products</span>
              </div>
            </div>
          </div>

          {/* Menu Sales Table */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={styles.tableHeader}>
              <FileText size={18} color="#10b981" />
              <h4 style={styles.tableTitle}>Product Sales Breakdown</h4>
            </div>
            <table className="crud-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Menu Product</th>
                  <th>Total Sales Revenue ($)</th>
                  <th>Sales Share Percentage</th>
                </tr>
              </thead>
              <tbody>
                {sales_breakdown.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>
                      No product sales transactions recorded.
                    </td>
                  </tr>
                ) : (
                  sales_breakdown.map((item, idx) => {
                    const percentage = totalMenuSales > 0 ? (item.revenue / totalMenuSales) * 100 : 0;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.menu_item}</td>
                        <td style={{ fontWeight: '700', color: '#10b981' }}>${item.revenue.toFixed(2)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '500', width: '45px' }}>{percentage.toFixed(1)}%</span>
                            <div style={styles.barContainer}>
                              <div style={{ ...styles.barFill, width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    boxSizing: 'border-box' as const,
    overflowY: 'auto' as const,
    flex: 1
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    height: '60vh'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(245,158,11,0.1)',
    borderRadius: '50%',
    borderTopColor: '#f59e0b',
    animation: 'spin 1s linear infinite'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '16px'
  },
  tabButtons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const
  },
  reportArea: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px'
  },
  summaryCard: {
    padding: '20px',
    textAlign: 'left' as const
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '40px'
  },
  summaryCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  summaryLabel: {
    fontSize: '0.8rem',
    color: '#9ca3af',
    fontWeight: '500'
  },
  summaryVal: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)'
  },
  summaryDivider: {
    width: '1px',
    height: '40px',
    backgroundColor: 'var(--border-glass)'
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    textAlign: 'left' as const
  },
  tableTitle: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  badgeGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: '#10b981',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: '700'
  },
  badgeOrange: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: '700'
  },
  badgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: '700'
  },
  barContainer: {
    flex: 1,
    height: '6px',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: '3px',
    overflow: 'hidden',
    width: '100px'
  },
  barFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: '3px'
  }
};
