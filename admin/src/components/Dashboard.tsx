import React, { useState } from 'react';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  X,
  Send
} from 'lucide-react';
import type { AnalyticsData, Ingredient } from '../types';

type PredictionStatus = 'critical' | 'warning' | 'low' | 'normal';

function getPredictionDetails(item: Ingredient) {
  const ratio = item.reorder_point > 0 ? item.stock_level / item.reorder_point : 1;
  let status: PredictionStatus = 'normal';
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
}

const STATUS_COLOR: Record<PredictionStatus, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  low: '#eab308',
  normal: '#10b981'
};

interface DashboardProps {
  analyticsData: AnalyticsData | null;
  loading: boolean;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  ingredients: Ingredient[];
  onCreateRequest?: (data: any) => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  analyticsData, 
  loading,
  analyticsDays,
  setAnalyticsDays,
  ingredients,
  onCreateRequest
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: number; date: string } | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{ x: number; y: number; name: string; value: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [activeRefillId, setActiveRefillId] = useState<number | null>(null);
  const [refillStaff, setRefillStaff] = useState<string>('');
  const [refillQty, setRefillQty] = useState<string>('');
  const [refillNotes, setRefillNotes] = useState<string>('');

  const handleSubmittingRefillRequest = async (ingredientId: number) => {
    if (!refillStaff.trim() || !refillQty.trim()) {
      alert('Staff name and quantity are required.');
      return;
    }
    const qty = parseFloat(refillQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity greater than 0.');
      return;
    }
    if (onCreateRequest) {
      await onCreateRequest({
        ingredient_id: ingredientId,
        staff_name: refillStaff.trim(),
        quantity: qty,
        notes: refillNotes.trim() || null
      });
      // Clear forms
      setActiveRefillId(null);
      setRefillStaff('');
      setRefillQty('');
      setRefillNotes('');
    }
  };

  if (loading || !analyticsData) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <span style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Gathering coffee shop statistics...</span>
      </div>
    );
  }

  const { kpi, revenue_trend, category_distribution, low_stock_items } = analyticsData;

  const predictionItems = [...ingredients]
    .sort((a, b) => {
      const ratioA = a.reorder_point > 0 ? a.stock_level / a.reorder_point : 1;
      const ratioB = b.reorder_point > 0 ? b.stock_level / b.reorder_point : 1;
      return ratioA - ratioB;
    })
    .slice(0, 5);

  const predictionRows = predictionItems.map((item) => ({
    item,
    ...getPredictionDetails(item)
  }));
  const maxDaysLeft = Math.max(...predictionRows.map((row) => row.estDaysLeft), 7);

  // Helpers for SVG Line Chart (Revenue Trend)
  const maxRevenue = Math.max(...revenue_trend.map(d => d.revenue), 100);
  const chartHeight = 130;
  const chartWidth = 500;
  const paddingX = 40;
  const paddingY = 20;

  const points = revenue_trend.map((d, index) => {
    const x = paddingX + (index * (chartWidth - paddingX * 2)) / (revenue_trend.length - 1 || 1);
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
  
  // Calculate bar width and gap dynamically to prevent overflow
  const barCount = category_distribution.length || 1;
  const availableWidth = barChartWidth - paddingX * 2 - 30;
  const barWidth = Math.min(35, Math.floor(availableWidth / barCount) * 0.45);
  const barGap = barCount > 1 ? Math.floor((availableWidth - barWidth * barCount) / (barCount - 1)) : 45;

  return (
    <div style={styles.container} className="page-scroll fade-in">
      {/* 3 KPI Hero Stats Cards */}
      <div style={styles.statsGrid}>
        {/* KPI 1: Total Ingredients */}
        <div style={styles.card} className="glass-card group relative transition-all duration-300 ease-out cursor-pointer hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-950/10">
          <div style={styles.statIconContainer} className="group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
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
          border: kpi.low_stock_count > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--table-border)'
        }} className="glass-card group relative transition-all duration-300 ease-out cursor-pointer hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-950/10">
          <div style={{
            ...styles.statIconContainer,
            backgroundColor: kpi.low_stock_count > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface-muted)'
          }} className="group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <AlertTriangle size={22} color={kpi.low_stock_count > 0 ? '#ef4444' : '#10b981'} />
          </div>
          <div style={styles.statDetails}>
            <span style={styles.statLabel}>Low Stock Items</span>
            <span style={{
              ...styles.statValue,
              color: kpi.low_stock_count > 0 ? '#ef4444' : 'var(--text-primary)'
            }}>{kpi.low_stock_count} Alerts</span>
            <div style={styles.statTrend}>
              <span style={kpi.low_stock_count > 0 ? styles.trendTextRed : styles.trendTextGreen}>
                {kpi.low_stock_count > 0 ? 'Action required immediately' : 'Inventory fully stocked'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Monthly Stock In Value */}
        <div style={styles.card} className="glass-card group relative transition-all duration-300 ease-out cursor-pointer hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-950/10">
          <div style={styles.statIconContainer} className="group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <TrendingUp size={22} color="#10b981" />
          </div>
          <div style={styles.statDetails}>
            <span style={styles.statLabel}>Stock-In (30d)</span>
            <span style={styles.statValue}>₱{kpi.total_stock_in_value.toFixed(2)}</span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ ...styles.chartTitle, margin: 0 }}>Cafe POS Sales Trend</h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[7, 14, 30].map(days => (
                <button
                  key={days}
                  onClick={() => setAnalyticsDays(days)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    border: analyticsDays === days ? '1px solid #f59e0b' : '1px solid var(--border-glass)',
                    backgroundColor: analyticsDays === days ? 'rgba(245,158,11,0.12)' : 'var(--surface-muted)',
                    color: analyticsDays === days ? '#f59e0b' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: analyticsDays === days ? '600' : '400',
                    transition: 'all 0.2s'
                  }}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>
          
          <div style={styles.svgContainer}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={styles.svg}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="var(--chart-grid)" />
              <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="var(--chart-grid)" />
              <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="var(--chart-grid)" />
              
              {areaPath && <path d={areaPath} fill="url(#revGrad)" />}
              {linePath && <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" />}
              
              {/* Guidelines on hover */}
              {hoveredPoint && (
                <line
                  x1={hoveredPoint.x}
                  y1={paddingY}
                  x2={hoveredPoint.x}
                  y2={chartHeight - paddingY}
                  stroke="#f59e0b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
              )}

              {points.map((p, i) => {
                const showDate = revenue_trend.length <= 7 || i % Math.ceil(revenue_trend.length / 7) === 0;
                return (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="3.5" fill="var(--chart-dot-fill)" stroke="#f59e0b" strokeWidth="2" />
                    {showDate && (
                      <text x={p.x} y={chartHeight - 4} fill="var(--text-muted)" fontSize="9" textAnchor="middle">{p.date}</text>
                    )}
                  </g>
                );
              })}

              {/* Glowing point on hover */}
              {hoveredPoint && (
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="7"
                  fill="#f59e0b"
                  opacity="0.4"
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* Transparent hover zones */}
              {points.map((p, i) => {
                const zoneWidth = (chartWidth - paddingX * 2) / (points.length - 1 || 1);
                return (
                  <rect
                    key={`zone-${i}`}
                    x={p.x - zoneWidth / 2}
                    y={paddingY}
                    width={zoneWidth}
                    height={chartHeight - paddingY * 2}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint && (
              <div style={{
                position: 'absolute',
                left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                top: `${(hoveredPoint.y / chartHeight) * 100 - 15}%`,
                transform: 'translate(-50%, -100%)',
                backgroundColor: 'var(--tooltip-bg)',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '6px 10px',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                pointerEvents: 'none',
                boxShadow: 'var(--card-shadow)',
                zIndex: 100,
                minWidth: '90px',
                textAlign: 'center',
                backdropFilter: 'blur(8px)'
              }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: '2px' }}>{hoveredPoint.date}</div>
                <div style={{ fontWeight: '700', color: '#f59e0b' }}>₱{hoveredPoint.val.toFixed(2)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Category Breakdown */}
        <div style={styles.chartCard} className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ ...styles.chartTitle, margin: 0 }}>Ingredients by Category</h3>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-glass)',
                  backgroundColor: 'var(--surface-muted)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s'
                }}
              >
                <X size={12} />
                <span>Clear Focus</span>
              </button>
            )}
          </div>
          
          <div style={styles.svgContainer}>
            <svg viewBox={`0 0 ${barChartWidth} ${barChartHeight}`} style={styles.svg}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="barGradHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              <line x1={paddingX} y1={paddingY} x2={barChartWidth - paddingX} y2={paddingY} stroke="var(--chart-grid)" />
              <line x1={paddingX} y1={barChartHeight - paddingY} x2={barChartWidth - paddingX} y2={barChartHeight - paddingY} stroke="var(--chart-grid)" />

              {category_distribution.map((cat, index) => {
                const x = paddingX + 15 + index * (barWidth + barGap);
                const height = (cat.value / maxCategoryCount) * (barChartHeight - paddingY * 2);
                const y = barChartHeight - paddingY - height;
                const isHovered = hoveredBar && hoveredBar.name === cat.name;
                const isSelected = selectedCategory === cat.name;

                return (
                  <g key={index}>
                    <rect 
                      x={x} 
                      y={y} 
                      width={barWidth} 
                      height={height} 
                      rx="4" 
                      fill={isHovered ? 'url(#barGradHover)' : isSelected ? '#3b82f6' : 'url(#barGrad)'} 
                      stroke={isHovered || isSelected ? '#60a5fa' : '#3b82f6'}
                      strokeWidth={isHovered || isSelected ? '1.5' : '1'}
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                      onMouseEnter={() => setHoveredBar({ x: x + barWidth / 2, y, name: cat.name, value: cat.value })}
                      onMouseLeave={() => setHoveredBar(null)}
                      onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
                    />
                    <text x={x + barWidth / 2} y={barChartHeight - 4} fill="var(--text-muted)" fontSize="9" textAnchor="middle">
                      {cat.name.length > 8 ? `${cat.name.substring(0, 8)}.` : cat.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredBar && (
              <div style={{
                position: 'absolute',
                left: `${(hoveredBar.x / barChartWidth) * 100}%`,
                top: `${(hoveredBar.y / barChartHeight) * 100 - 15}%`,
                transform: 'translate(-50%, -100%)',
                backgroundColor: 'var(--tooltip-bg)',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                padding: '6px 10px',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                pointerEvents: 'none',
                boxShadow: 'var(--card-shadow)',
                zIndex: 100,
                minWidth: '100px',
                textAlign: 'center',
                backdropFilter: 'blur(8px)'
              }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: '2px' }}>{hoveredBar.name}</div>
                <div style={{ fontWeight: '700', color: '#60a5fa' }}>{hoveredBar.value} Items</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Category Focus Panel */}
      {selectedCategory && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--chart-grid)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Category Focus: {selectedCategory}
              </h3>
            </div>
            <button 
              onClick={() => setSelectedCategory(null)} 
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="crud-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ingredient Name</th>
                  <th>Inventory Health</th>
                  <th>Current Stock</th>
                  <th>Reorder Point</th>
                  <th>Cost per Unit</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ingredients
                  .filter(ing => ing.category.toLowerCase() === selectedCategory.toLowerCase())
                  .map(ing => {
                    const isLow = ing.stock_level <= ing.reorder_point;
                    const percent = Math.min((ing.stock_level / Math.max(ing.reorder_point * 2, 1)) * 100, 100);
                    const isRefillOpen = activeRefillId === ing.id;
                    
                    return (
                      <React.Fragment key={ing.id}>
                        <tr>
                          <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{ing.name}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
                              <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--surface-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${percent}%`, backgroundColor: isLow ? '#ef4444' : '#10b981', borderRadius: '3px' }}></div>
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: isLow ? '#ef4444' : '#10b981' }}>
                                {isLow ? 'Low Stock' : 'Normal'}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontWeight: '700', color: isLow ? '#ef4444' : 'var(--text-primary)' }}>
                            {ing.stock_level} {ing.unit}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{ing.reorder_point} {ing.unit}</td>
                          <td>₱{ing.cost_per_unit.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                if (isRefillOpen) {
                                  setActiveRefillId(null);
                                } else {
                                  setActiveRefillId(ing.id);
                                  setRefillQty('');
                                  setRefillNotes('');
                                }
                              }}
                              className="btn"
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '0.8rem',
                                backgroundColor: isRefillOpen ? 'var(--surface-hover)' : 'rgba(59,130,246,0.1)',
                                border: isRefillOpen ? '1px solid var(--border-glass)' : '1px solid rgba(59,130,246,0.2)',
                                color: isRefillOpen ? 'var(--text-muted)' : '#60a5fa'
                              }}
                            >
                              {isRefillOpen ? 'Cancel' : 'Request Refill'}
                            </button>
                          </td>
                        </tr>
                        {isRefillOpen && (
                          <tr>
                            <td colSpan={6} style={{ backgroundColor: 'var(--surface-muted)', padding: '16px', borderTop: 'none' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '200px' }}>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Staff Name</label>
                                  <input
                                    type="text"
                                    className="glass-input"
                                    placeholder="e.g. Marcus Aurelius"
                                    value={refillStaff}
                                    onChange={(e) => setRefillStaff(e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '120px' }}>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Quantity ({ing.unit})</label>
                                  <input
                                    type="number"
                                    step="any"
                                    className="glass-input"
                                    placeholder="e.g. 10"
                                    value={refillQty}
                                    onChange={(e) => setRefillQty(e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '200px' }}>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Reason / Notes</label>
                                  <input
                                    type="text"
                                    className="glass-input"
                                    placeholder="For espresso bar restocking..."
                                    value={refillNotes}
                                    onChange={(e) => setRefillNotes(e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                  />
                                </div>
                                <button
                                  onClick={() => handleSubmittingRefillRequest(ing.id)}
                                  className="btn btn-primary"
                                  style={{ padding: '8px 16px', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <Send size={14} />
                                  <span>Submit Request</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Two Columns Grid for lists */}
      <div style={styles.listsGrid}>
        {/* Left Column: Inventory alert & prediction */}
        <div style={styles.listCard} className="glass-card">
          <div style={styles.listHeader}>
            <div>
              <h3 style={styles.listTitle}>Inventory Alert & Prediction</h3>
              <p style={styles.listSubtitle}>Critical stock levels and estimated days remaining (Top 5)</p>
            </div>
            <TrendingDown size={18} color="#f59e0b" />
          </div>

          {predictionRows.length === 0 ? (
            <div style={styles.emptyState}>
              <span>No ingredients to predict yet.</span>
            </div>
          ) : (
            <>
              <div style={styles.predictionChart}>
                {predictionRows.map(({ item, status, estDaysLeft }) => {
                  const widthPct = Math.max(6, (estDaysLeft / maxDaysLeft) * 100);
                  return (
                    <div key={item.id} style={styles.predictionBarRow}>
                      <span style={styles.predictionBarLabel} title={item.name}>{item.name}</span>
                      <div style={styles.predictionBarTrack}>
                        <div style={{
                          ...styles.predictionBarFill,
                          width: `${widthPct}%`,
                          backgroundColor: STATUS_COLOR[status]
                        }} />
                      </div>
                      <span style={{
                        ...styles.predictionBarDays,
                        color: STATUS_COLOR[status]
                      }}>
                        {estDaysLeft === 0 ? 'Out' : `${estDaysLeft}d`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="table-scroll">
                <table className="crud-table" style={{ width: '100%', minWidth: 640, fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Stock</th>
                      <th>Min</th>
                      <th>Status</th>
                      <th>Days left</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictionRows.map(({ item, status, estDaysLeft, suggestedAction }) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</td>
                        <td>{item.stock_level} {item.unit}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{item.reorder_point} {item.unit}</td>
                        <td>
                          <span style={{
                            ...styles.statusPill,
                            color: STATUS_COLOR[status],
                            backgroundColor: `${STATUS_COLOR[status]}18`,
                            border: `1px solid ${STATUS_COLOR[status]}33`
                          }}>
                            {status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: STATUS_COLOR[status] }}>
                          {estDaysLeft === 0 ? 'Out of stock' : `${estDaysLeft} days`}
                        </td>
                        <td>
                          <span style={styles.actionPill}>{suggestedAction}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={styles.predictionFoot}>
                Supplier delivery typically takes 3–5 days. Plan restocks for critical items.
              </p>
            </>
          )}
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
    minHeight: 0,
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
    backgroundColor: 'var(--surface-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border-glass)'
  },
  statDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const,
    flex: 1
  },
  statLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: '500'
  },
  statValue: {
    fontSize: '1.4rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
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
    color: 'var(--text-muted)'
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
    textAlign: 'left' as const,
    position: 'relative' as const
  },
  chartTitle: {
    margin: '0 0 16px 0',
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '0.02em'
  },
  svgContainer: {
    width: '100%',
    height: '140px',
    position: 'relative' as const
  },
  svg: {
    width: '100%',
    height: '100%',
    overflow: 'visible' as const
  },
  listsGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px'
  },
  listCard: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--table-border)',
    paddingBottom: '12px',
    marginBottom: '16px'
  },
  listTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  listSubtitle: {
    margin: '4px 0 0',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 500
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
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontStyle: 'italic'
  },
  predictionChart: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    padding: '4px 0 12px',
    borderBottom: '1px solid var(--table-border)',
    marginBottom: '8px'
  },
  predictionBarRow: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr 48px',
    alignItems: 'center',
    gap: '10px'
  },
  predictionBarLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  predictionBarTrack: {
    height: '10px',
    borderRadius: '999px',
    backgroundColor: 'var(--surface-hover)',
    overflow: 'hidden'
  },
  predictionBarFill: {
    height: '100%',
    borderRadius: '999px',
    minWidth: '8px'
  },
  predictionBarDays: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textAlign: 'right' as const
  },
  statusPill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'capitalize' as const
  },
  actionPill: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    color: 'var(--text-primary)',
    backgroundColor: 'var(--surface-muted)',
    border: '1px solid var(--border-glass)'
  },
  predictionFoot: {
    margin: '10px 0 0',
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
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
    color: 'var(--text-primary)'
  },
  lowStockCategory: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
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
    color: 'var(--text-muted)',
    marginTop: '2px'
  }
};
