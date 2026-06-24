import React, { useState } from 'react';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  ClipboardList,
  X,
  Send
} from 'lucide-react';
import type { AnalyticsData, Ingredient } from '../types';

interface DashboardProps {
  analyticsData: AnalyticsData | null;
  loading: boolean;
  onApproveRequest?: (id: number) => void;
  onRejectRequest?: (id: number) => void;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  ingredients: Ingredient[];
  onCreateRequest?: (data: any) => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  analyticsData, 
  loading,
  onApproveRequest,
  onRejectRequest,
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
                    border: analyticsDays === days ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: analyticsDays === days ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.02)',
                    color: analyticsDays === days ? '#f59e0b' : '#9ca3af',
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
              <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.05)" />
              <line x1={paddingX} y1={chartHeight / 2} x2={chartWidth - paddingX} y2={chartHeight / 2} stroke="rgba(255,255,255,0.05)" />
              <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="rgba(255,255,255,0.05)" />
              
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
                    <circle cx={p.x} cy={p.y} r="3.5" fill="#0b0b0e" stroke="#f59e0b" strokeWidth="2" />
                    {showDate && (
                      <text x={p.x} y={chartHeight - 4} fill="#9ca3af" fontSize="9" textAnchor="middle">{p.date}</text>
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
                backgroundColor: 'rgba(15, 10, 5, 0.95)',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#fff',
                fontSize: '0.75rem',
                pointerEvents: 'none',
                boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
                zIndex: 100,
                minWidth: '90px',
                textAlign: 'center',
                backdropFilter: 'blur(8px)'
              }}>
                <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginBottom: '2px' }}>{hoveredPoint.date}</div>
                <div style={{ fontWeight: '700', color: '#f59e0b' }}>${hoveredPoint.val.toFixed(2)}</div>
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
                  border: '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  color: '#9ca3af',
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
              <line x1={paddingX} y1={paddingY} x2={barChartWidth - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.05)" />
              <line x1={paddingX} y1={barChartHeight - paddingY} x2={barChartWidth - paddingX} y2={barChartHeight - paddingY} stroke="rgba(255,255,255,0.05)" />

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
                    <text x={x + barWidth / 2} y={barChartHeight - 4} fill="#9ca3af" fontSize="9" textAnchor="middle">
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
                backgroundColor: 'rgba(5, 10, 20, 0.95)',
                border: '1px solid #3b82f6',
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#fff',
                fontSize: '0.75rem',
                pointerEvents: 'none',
                boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
                zIndex: 100,
                minWidth: '100px',
                textAlign: 'center',
                backdropFilter: 'blur(8px)'
              }}>
                <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginBottom: '2px' }}>{hoveredBar.name}</div>
                <div style={{ fontWeight: '700', color: '#60a5fa' }}>{hoveredBar.value} Items</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Category Focus Panel */}
      {selectedCategory && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#fff' }}>
                Category Focus: {selectedCategory}
              </h3>
            </div>
            <button 
              onClick={() => setSelectedCategory(null)} 
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}
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
                          <td style={{ fontWeight: '600', color: '#fff' }}>{ing.name}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
                              <div style={{ flex: 1, height: '6px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${percent}%`, backgroundColor: isLow ? '#ef4444' : '#10b981', borderRadius: '3px' }}></div>
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: isLow ? '#ef4444' : '#10b981' }}>
                                {isLow ? 'Low Stock' : 'Normal'}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontWeight: '700', color: isLow ? '#ef4444' : '#fff' }}>
                            {ing.stock_level} {ing.unit}
                          </td>
                          <td style={{ color: '#9ca3af' }}>{ing.reorder_point} {ing.unit}</td>
                          <td>${ing.cost_per_unit.toFixed(2)}</td>
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
                                backgroundColor: isRefillOpen ? 'rgba(255,255,255,0.05)' : 'rgba(59,130,246,0.1)',
                                border: isRefillOpen ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(59,130,246,0.2)',
                                color: isRefillOpen ? '#9ca3af' : '#60a5fa'
                              }}
                            >
                              {isRefillOpen ? 'Cancel' : 'Request Refill'}
                            </button>
                          </td>
                        </tr>
                        {isRefillOpen && (
                          <tr>
                            <td colSpan={6} style={{ backgroundColor: 'rgba(255,255,255,0.01)', padding: '16px', borderTop: 'none' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '200px' }}>
                                  <label style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600' }}>Staff Name</label>
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
                                  <label style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600' }}>Quantity ({ing.unit})</label>
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
                                  <label style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600' }}>Reason / Notes</label>
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
    textAlign: 'left' as const,
    position: 'relative' as const
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
    height: '140px',
    position: 'relative' as const
  },
  svg: {
    width: '100%',
    height: '100%',
    overflow: 'visible' as const
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
