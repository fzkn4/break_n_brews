import React from 'react';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  ClipboardList
} from 'lucide-react';
import type { AnalyticsData } from '../types';

interface DashboardProps {
  analyticsData: AnalyticsData | null;
  loading: boolean;
  onApproveRequest?: (id: number) => void;
  onRejectRequest?: (id: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  analyticsData, 
  loading,
  onApproveRequest,
  onRejectRequest
}) => {
  if (loading || !analyticsData) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <span style={{ marginTop: '12px', color: '#9ca3af' }}>Gathering coffee shop statistics...</span>
      </div>
    );
  }

  const { kpi, revenue_trend, category_distribution, recent_requests, low_stock_items } = analyticsData;

  // Helpers for SVG Line Chart (Revenue Trend)
  const maxRevenue = Math.max(...revenue_trend.map(d => d.revenue), 100);
  const chartHeight = 130;
  const chartWidth = 500;
  const paddingX = 40;
  const paddingY = 20;

  const points = revenue_trend.map((d, index) => {
    const x = paddingX + (index * (chartWidth - paddingX * 2)) / (revenue_trend.length - 1);
    const y = chartHeight - paddingY - (d.revenue / maxRevenue) * (chartHeight - paddingY * 2);
    return { x, y, val: d.revenue, date: d.date };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z` 
    : '';

  // Helpers for Category Distribution SVG Bar Chart
  const maxCategoryCount = Math.max(...category_distribution.map(c => c.value), 5);
  const barChartHeight = 130;
  const barChartWidth = 500;
  const barWidth = 35;
  const barGap = 45;

  return (
    <div style={styles.container} className="fade-in">
      {/* 4 KPI Hero Stats Cards */}
      <div style={styles.statsGrid}>
        {/* KPI 1: Total Ingredients */}
        <div style={styles.card} className="glass-card">
          <div style={styles.statIconContainer}>
            <Package size={22} color="#f59e0b" />
          </div>
          <div style={styles.statDetails}>
            <span style={styles.statLabel}>Total Ingredients</span>
            <span style={styles.statValue}>{kpi.total_ingredients} Items</span>
            <div style={styles.statTrend}>
              <span style={styles.trendTextMuted}>Catalog active count</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Low Stock Alerts */}
        <div style={{
          ...styles.card,
          border: kpi.low_stock_count > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)'
        }} className="glass-card">
          <div style={{
            ...styles.statIconContainer,
            backgroundColor: kpi.low_stock_count > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.02)'
          }}>
            <AlertTriangle size={22} color={kpi.low_stock_count > 0 ? '#ef4444' : '#10b981'} />
          </div>
          <div style={styles.statDetails}>
            <span style={styles.statLabel}>Low Stock Items</span>
            <span style={{
              ...styles.statValue,
              color: kpi.low_stock_count > 0 ? '#ef4444' : '#fff'
            }}>{kpi.low_stock_count} Alerts</span>
            <div style={styles.statTrend}>
              <span style={kpi.low_stock_count > 0 ? styles.trendTextRed : styles.trendTextGreen}>
                {kpi.low_stock_count > 0 ? 'Action required immediately' : 'Inventory fully stocked'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Pending Requests */}
        <div style={styles.card} className="glass-card">
          <div style={styles.statIconContainer}>
            <Clock size={22} color="#3b82f6" />
          </div>
          <div style={styles.statDetails}>
            <span style={styles.statLabel}>Pending Requests</span>
            <span style={styles.statValue}>{kpi.pending_requests} Pending</span>
            <div style={styles.statTrend}>
              <span style={kpi.pending_requests > 0 ? styles.trendTextYellow : styles.trendTextGreen}>
                {kpi.pending_requests > 0 ? 'Awaiting supervisor approval' : 'All requests resolved'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Monthly Stock In Value */}
        <div style={styles.card} className="glass-card">
          <div style={styles.statIconContainer}>
            <TrendingUp size={22} color="#10b981" />
          </div>
          <div style={styles.statDetails}>
            <span style={styles.statLabel}>Stock-In (30d)</span>
            <span style={styles.statValue}>${kpi.total_stock_in_value.toFixed(2)}</span>
            <div style={styles.statTrend}>
              <span style={styles.trendTextMuted}>Total shipment costs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div style={styles.chartsGrid}>
        {/* Chart 1: Revenue trend from sales */}
        <div style={styles.chartCard} className="glass-card">
          <h3 style={styles.chartTitle}>7-Day Cafe POS Sales Trend</h3>
          <div style={styles.svgContainer}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={styles.svg}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.05)" />
              <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="rgba(255,255,255,0.05)" />
              <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="rgba(255,255,255,0.05)" />
              
              {areaPath && <path d={areaPath} fill="url(#revGrad)" />}
              {linePath && <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" />}
              
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="4" fill="#0b0b0e" stroke="#f59e0b" strokeWidth="2" />
                  <text x={p.x} y={chartHeight - 4} fill="#9ca3af" fontSize="9" textAnchor="middle">{p.date}</text>
                  <text x={p.x} y={p.y - 8} fill="#fff" fontSize="8" fontWeight="600" textAnchor="middle">${Math.round(p.val)}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Chart 2: Category Breakdown */}
        <div style={styles.chartCard} className="glass-card">
          <h3 style={styles.chartTitle}>Ingredients Count by Category</h3>
          <div style={styles.svgContainer}>
            <svg viewBox={`0 0 ${barChartWidth} ${barChartHeight}`} style={styles.svg}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <line x1={paddingX} y1={paddingY} x2={barChartWidth - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.05)" />
              <line x1={paddingX} y1={barChartHeight - paddingY} x2={barChartWidth - paddingX} y2={barChartHeight - paddingY} stroke="rgba(255,255,255,0.05)" />

              {category_distribution.map((cat, index) => {
                const x = paddingX + 25 + index * (barWidth + barGap);
                const height = (cat.value / maxCategoryCount) * (barChartHeight - paddingY * 2);
                const y = barChartHeight - paddingY - height;
                return (
                  <g key={index}>
                    <rect 
                      x={x} 
                      y={y} 
                      width={barWidth} 
                      height={height} 
                      rx="4" 
                      fill="url(#barGrad)" 
                      stroke="#3b82f6"
                      strokeWidth="1"
                    />
                    <text x={x + barWidth / 2} y={barChartHeight - 4} fill="#9ca3af" fontSize="9" textAnchor="middle">
                      {cat.name.length > 8 ? `${cat.name.substring(0, 8)}.` : cat.name}
                    </text>
                    <text x={x + barWidth / 2} y={y - 6} fill="#fff" fontSize="9" fontWeight="600" textAnchor="middle">{cat.value}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Two Columns Grid for lists */}
      <div style={styles.listsGrid}>
        {/* Left Column: Quick requests review */}
        <div style={styles.listCard} className="glass-card">
          <div style={styles.listHeader}>
            <h3 style={styles.listTitle}>Pending Requests Quick Actions</h3>
            <ClipboardList size={18} color="#3b82f6" />
          </div>

          <div style={styles.listContent}>
            {recent_requests.length === 0 ? (
              <div style={styles.emptyState}>
                <span>No pending ingredient requests to review.</span>
              </div>
            ) : (
              recent_requests.map((req) => (
                <div key={req.id} style={styles.requestItem}>
                  <div style={styles.requestDetails}>
                    <div style={styles.requestHeading}>
                      <span style={styles.requestIngName}>{req.ingredient_name}</span>
                      <span style={styles.requestQty}>
                        Request: {req.quantity} {req.ingredient_unit}
                      </span>
                    </div>
                    <div style={styles.requestSubheading}>
                      <span>By: {req.staff_name}</span>
                      {req.notes && <span style={styles.requestNotes}>"{req.notes}"</span>}
                    </div>
                  </div>

                  <div style={styles.actions}>
                    {onRejectRequest && (
                      <button 
                        onClick={() => onRejectRequest(req.id)}
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Reject
                      </button>
                    )}
                    {onApproveRequest && (
                      <button 
                        onClick={() => onApproveRequest(req.id)}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Low Stock Alerts list */}
        <div style={styles.listCard} className="glass-card">
          <div style={styles.listHeader}>
            <h3 style={styles.listTitle}>Inventory Health Warnings</h3>
            <AlertTriangle size={18} color="#ef4444" />
          </div>

          <div style={styles.listContent}>
            {low_stock_items.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={{ color: '#10b981' }}>✔ All ingredient stock levels are normal.</span>
              </div>
            ) : (
              low_stock_items.map((ing) => (
                <div key={ing.id} style={styles.lowStockItem}>
                  <div style={styles.lowStockMeta}>
                    <span style={styles.lowStockName}>{ing.name}</span>
                    <span style={styles.lowStockCategory}>{ing.category}</span>
                  </div>
                  <div style={styles.lowStockStatus}>
                    <span style={styles.lowStockLabel}>Current:</span>
                    <span style={styles.lowStockLevel}>
                      {ing.stock_level} {ing.unit}
                    </span>
                    <span style={styles.lowStockReorder}>
                      (Reorder point: {ing.reorder_point} {ing.unit})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
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
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px'
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px'
  },
  statIconContainer: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  statDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const,
    flex: 1
  },
  statLabel: {
    fontSize: '0.8rem',
    color: '#9ca3af',
    fontWeight: '500'
  },
  statValue: {
    fontSize: '1.4rem',
    fontWeight: '700',
    color: '#fff',
    margin: '4px 0'
  },
  statTrend: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '2px'
  },
  trendTextMuted: {
    fontSize: '0.75rem',
    color: '#6b7280'
  },
  trendTextGreen: {
    fontSize: '0.75rem',
    color: '#10b981',
    fontWeight: '600'
  },
  trendTextYellow: {
    fontSize: '0.75rem',
    color: '#f59e0b',
    fontWeight: '600'
  },
  trendTextRed: {
    fontSize: '0.75rem',
    color: '#ef4444',
    fontWeight: '600'
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
    gap: '20px'
  },
  chartCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const
  },
  chartTitle: {
    margin: '0 0 16px 0',
    fontSize: '1rem',
    fontWeight: '700',
    color: '#fff',
    letterSpacing: '0.02em'
  },
  svgContainer: {
    width: '100%',
    height: '140px'
  },
  svg: {
    width: '100%',
    height: '100%',
    overflow: 'visible'
  },
  listsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
    gap: '20px'
  },
  listCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const,
    minHeight: '280px'
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '12px',
    marginBottom: '16px'
  },
  listTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: '700',
    color: '#fff'
  },
  listContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    flex: 1
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6b7280',
    fontSize: '0.85rem',
    fontStyle: 'italic'
  },
  requestItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    backgroundColor: 'rgba(255,255,255,0.01)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '8px'
  },
  requestDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flex: 1,
    paddingRight: '12px'
  },
  requestHeading: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px'
  },
  requestIngName: {
    fontWeight: '600',
    fontSize: '0.9rem',
    color: '#fff'
  },
  requestQty: {
    fontSize: '0.8rem',
    color: '#f59e0b',
    fontWeight: '500'
  },
  requestSubheading: {
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: '0.75rem',
    color: '#9ca3af'
  },
  requestNotes: {
    fontStyle: 'italic',
    color: '#6b7280',
    marginTop: '2px'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  lowStockItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    backgroundColor: 'rgba(239, 68, 68, 0.02)',
    border: '1px solid rgba(239, 68, 68, 0.1)',
    borderRadius: '8px'
  },
  lowStockMeta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px'
  },
  lowStockName: {
    fontWeight: '600',
    fontSize: '0.9rem',
    color: '#fff'
  },
  lowStockCategory: {
    fontSize: '0.75rem',
    color: '#9ca3af'
  },
  lowStockStatus: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    fontSize: '0.8rem'
  },
  lowStockLabel: {
    fontSize: '0.75rem',
    color: '#ef4444',
    fontWeight: '500'
  },
  lowStockLevel: {
    fontWeight: '700',
    color: '#ef4444',
    fontSize: '0.9rem'
  },
  lowStockReorder: {
    fontSize: '0.7rem',
    color: '#6b7280',
    marginTop: '2px'
  }
};
