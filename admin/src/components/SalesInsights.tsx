import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  ExternalLink,
  Globe,
  Hourglass,
  Info,
  Lightbulb,
  Loader2,
  MapPin,
  Megaphone,
  PackagePlus,
  RefreshCw,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  XCircle
} from 'lucide-react';
import type {
  ForecastIngredient,
  ForecastItem,
  Insight,
  InsightKind,
  InsightRun,
  InsightsOverview,
  SalesForecast,
  WeatherDay
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const INSIGHTS_URL = `${API_URL}/insights`;

interface SalesInsightsProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
  currentUserName: string | null;
  onNavigate: (tab: string) => void;
}

const KIND_META: Record<InsightKind, { label: string; color: string; icon: React.ElementType }> = {
  selling_well: { label: 'Selling well', color: '#10b981', icon: TrendingUp },
  slowing_down: { label: 'Slowing down', color: '#ef4444', icon: TrendingDown },
  stock_up: { label: 'Stock up', color: '#f59e0b', icon: PackagePlus },
  use_soon: { label: 'Use soon', color: '#f97316', icon: Hourglass },
  promote: { label: 'Promote', color: '#8b5cf6', icon: Megaphone },
  menu_idea: { label: 'Menu idea', color: '#3b82f6', icon: Lightbulb },
  heads_up: { label: 'Heads-up', color: '#06b6d4', icon: Info }
};

const TREND_META: Record<ForecastItem['trend'], { label: string; color: string }> = {
  rising: { label: 'Rising', color: '#10b981' },
  falling: { label: 'Falling', color: '#ef4444' },
  steady: { label: 'Steady', color: 'var(--text-muted)' },
  new: { label: 'New', color: '#3b82f6' },
  idle: { label: 'Not selling', color: '#f97316' },
  no_sales: { label: 'No sales yet', color: 'var(--text-dark)' }
};

const money = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n: number) => `₱${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const qty = (n: number, unit: string) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;

// 'YYYY-MM-DD' is a store-local calendar date, not an instant.
function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const shortDate = (iso: string) => localDate(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

// Backend timestamps are naive UTC.
function ago(isoUtc: string | null): string {
  if (!isoUtc) return '';
  const seconds = Math.max(0, (Date.now() - new Date(isoUtc + 'Z').getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(isoUtc + 'Z').toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function weatherIcon(summary: string) {
  const s = summary.toLowerCase();
  if (s.includes('thunder')) return CloudLightning;
  if (s.includes('rain') || s.includes('drizzle') || s.includes('shower')) return CloudRain;
  if (s.includes('overcast') || s.includes('fog')) return Cloud;
  if (s.includes('partly') || s.includes('mostly')) return CloudSun;
  return Sun;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------- forecast chart

const ForecastChart: React.FC<{ days: SalesForecast['forecast'] }> = ({ days }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const pad = { top: 16, right: 8, bottom: 28, left: 52 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [0, niceMax / 2, niceMax];
  const col = innerW / days.length;
  const barW = Math.min(56, col - 2 * 6);
  const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Forecast sales for the next 7 days">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {moneyShort(t)}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = pad.left + i * col + (col - barW) / 2;
          const top = y(d.revenue);
          const h = Math.max(0, pad.top + innerH - top);
          const r = Math.min(4, h);
          const path = `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`;
          return (
            <g key={d.date}>
              <path d={path} fill="var(--accent-gold)" opacity={hover === null || hover === i ? 1 : 0.45} />
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={i === 0 ? 'var(--text-primary)' : 'var(--text-muted)'} fontWeight={i === 0 ? 700 : 400}>
                {i === 0 ? 'Today' : d.weekday}
              </text>
              <rect
                x={pad.left + i * col}
                y={pad.top}
                width={col}
                height={innerH + pad.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${d.weekday} ${shortDate(d.date)}: about ${money(d.revenue)}, ${d.units} items`}
              />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          style={{
            ...styles.tooltip,
            left: `${((pad.left + hover * col + col / 2) / W) * 100}%`
          }}
        >
          <strong>{days[hover].weekday}, {shortDate(days[hover].date)}</strong>
          <span>About {money(days[hover].revenue)}</span>
          <span style={{ color: 'var(--text-muted)' }}>~{days[hover].units.toFixed(0)} items</span>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------- insight card

const InsightCard: React.FC<{
  insight: Insight;
  index: number;
  rating: 'up' | 'down' | null;
  itemNames: Map<number, string>;
  ingredientById: Map<number, ForecastIngredient>;
  onRate: (index: number, rating: 'up' | 'down' | null) => void;
  onNavigate: (tab: string) => void;
}> = ({ insight, index, rating, itemNames, ingredientById, onRate, onNavigate }) => {
  const meta = KIND_META[insight.kind] || KIND_META.heads_up;
  const Icon = meta.icon;
  const items = insight.menu_item_ids.map((id) => itemNames.get(id)).filter(Boolean) as string[];
  const ings = insight.ingredient_ids.map((id) => ingredientById.get(id)).filter(Boolean) as ForecastIngredient[];
  const unit = ings.length === 1 ? ings[0].unit : '';

  return (
    <article className="glass-card" style={styles.insightCard}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...styles.kindBadge, color: meta.color, borderColor: meta.color }}>
          <Icon size={13} />
          {meta.label}
        </span>
        <span style={styles.confidence}>{insight.confidence} confidence</span>
      </header>
      <h4 style={styles.insightTitle}>{insight.title}</h4>
      <p style={styles.insightDetail}>{insight.detail}</p>
      {insight.action && (
        <div style={{ ...styles.actionBox, borderLeftColor: meta.color }}>
          <strong>Do this:</strong> {insight.action}
          {insight.suggested_quantity !== null && (
            <div style={{ marginTop: 4, fontWeight: 600 }}>
              Suggested amount: {qty(insight.suggested_quantity, unit)}
            </div>
          )}
        </div>
      )}
      {(items.length > 0 || ings.length > 0) && (
        <div style={styles.chips}>
          {items.map((n) => <span key={`i-${n}`} style={styles.chip}>{n}</span>)}
          {ings.map((i) => (
            <span key={`g-${i.id}`} style={styles.chip}>
              {i.name} · {qty(i.stock_level, i.unit)} left
            </span>
          ))}
        </div>
      )}
      {insight.evidence.length > 0 && (
        <ul style={styles.evidence}>
          {insight.evidence.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
      {insight.source_urls.length > 0 && (
        <div style={styles.sourceRow}>
          {insight.source_urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer noopener" style={styles.sourceLink}>
              <ExternalLink size={12} />
              {hostOf(u)}
            </a>
          ))}
        </div>
      )}
      <footer style={styles.insightFoot}>
        {(insight.kind === 'stock_up' || insight.kind === 'use_soon') && (
          <button className="btn btn-secondary" style={styles.smallBtn} onClick={() => onNavigate('stockin')}>
            <PackagePlus size={14} />
            Open Stock In
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Helpful?</span>
          <button
            type="button"
            aria-label="Helpful"
            aria-pressed={rating === 'up'}
            className={`insight-vote${rating === 'up' ? ' is-up' : ''}`}
            onClick={() => onRate(index, rating === 'up' ? null : 'up')}
          >
            <ThumbsUp size={14} />
          </button>
          <button
            type="button"
            aria-label="Not helpful"
            aria-pressed={rating === 'down'}
            className={`insight-vote${rating === 'down' ? ' is-down' : ''}`}
            onClick={() => onRate(index, rating === 'down' ? null : 'down')}
          >
            <ThumbsDown size={14} />
          </button>
        </div>
      </footer>
    </article>
  );
};

// ---------------------------------------------------------------------- page

export const SalesInsights: React.FC<SalesInsightsProps> = ({ showToast, currentUserName, onNavigate }) => {
  const [overview, setOverview] = useState<InsightsOverview | null>(null);
  const [forecast, setForecast] = useState<SalesForecast | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [kindFilter, setKindFilter] = useState<InsightKind | 'all'>('all');
  const [showAllItems, setShowAllItems] = useState(false);
  const [showAllStock, setShowAllStock] = useState(false);
  const [location, setLocation] = useState({ name: '', lat: '', lon: '' });
  const [savingLocation, setSavingLocation] = useState(false);

  const loadForecast = useCallback(async () => {
    try {
      const res = await fetch(`${INSIGHTS_URL}/forecast`);
      if (res.ok) setForecast(await res.json());
    } catch {
      /* the forecast panel shows its own empty state */
    }
  }, []);

  const wasRunning = useRef(false);
  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch(INSIGHTS_URL);
      if (res.ok) {
        const data: InsightsOverview = await res.json();
        // A run just finished: pick up the fresh forecast too.
        if (wasRunning.current && !data.running) loadForecast();
        wasRunning.current = !!data.running;
        setOverview(data);
      }
      setLoadError(!res.ok);
    } catch {
      setLoadError(true);
    }
  }, [loadForecast]);

  useEffect(() => {
    loadOverview();
    loadForecast();
  }, [loadOverview, loadForecast]);

  const running = !!overview?.running;
  useEffect(() => {
    const timer = setInterval(loadOverview, running ? 4000 : 20000);
    return () => clearInterval(timer);
  }, [loadOverview, running]);

  useEffect(() => {
    if (!overview) return;
    setLocation((prev) =>
      prev.name || prev.lat
        ? prev
        : {
            name: overview.settings.location_name || '',
            lat: overview.settings.latitude?.toString() || '',
            lon: overview.settings.longitude?.toString() || ''
          }
    );
  }, [overview]);

  const latest: InsightRun | null = overview?.latest || null;
  const itemNames = useMemo(() => new Map((forecast?.items || []).map((i) => [i.id, i.name])), [forecast]);
  const ingredientById = useMemo(() => new Map((forecast?.ingredients || []).map((i) => [i.id, i])), [forecast]);

  const runAnalysis = async () => {
    setStarting(true);
    try {
      const res = await fetch(`${INSIGHTS_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_by: currentUserName })
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not start the analysis'));
      showToast('Analysis started. It usually takes 1–2 minutes.');
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not start the analysis', 'error');
    } finally {
      setStarting(false);
    }
  };

  const rate = async (index: number, rating: 'up' | 'down' | null) => {
    if (!latest) return;
    const before = latest.feedback;
    const next = { ...before };
    if (rating) next[index] = { insight_index: index, rating, note: null, created_by: currentUserName, created_at: null };
    else delete next[index];
    setOverview((o) => (o && o.latest ? { ...o, latest: { ...o.latest, feedback: next } } : o));
    try {
      const res = await fetch(`${INSIGHTS_URL}/runs/${latest.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insight_index: index, rating: rating ?? 'none', created_by: currentUserName })
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not save feedback'));
      if (rating) showToast('Thanks. The next analysis will take this into account.');
    } catch (err) {
      setOverview((o) => (o && o.latest ? { ...o, latest: { ...o.latest, feedback: before } } : o));
      showToast(err instanceof Error ? err.message : 'Could not save feedback', 'error');
    }
  };

  const saveSettings = async (patch: Record<string, unknown>, success: string) => {
    setSavingLocation(true);
    try {
      const res = await fetch(`${INSIGHTS_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'Could not save'));
      const settings = await res.json();
      setOverview((o) => (o ? { ...o, settings } : o));
      showToast(success);
      if ('latitude' in patch) loadForecast();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save', 'error');
    } finally {
      setSavingLocation(false);
    }
  };

  if (!overview) {
    return (
      <div style={styles.container} className="page-scroll fade-in">
        <div className="glass-card" style={styles.empty}>
          {loadError ? (
            <>
              <XCircle size={28} color="#ef4444" />
              <p style={{ margin: 0, fontWeight: 600 }}>Could not reach the insights service</p>
              <button className="btn btn-secondary" onClick={loadOverview}>Try again</button>
            </>
          ) : (
            <>
              <Loader2 size={28} className="notif-spin" color="var(--text-muted)" />
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading sales insights…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const failedNewer =
    overview.last_failed &&
    (!latest || (overview.last_failed.started_at || '') > (latest.finished_at || ''));
  const insights = latest?.insights || [];
  const counts = insights.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] || 0) + 1 }), {});
  const shown = insights
    .map((insight, index) => ({ insight, index }))
    .filter(({ insight }) => kindFilter === 'all' || insight.kind === kindFilter);
  const weatherByDate = new Map<string, WeatherDay>((forecast?.weather || []).map((w) => [w.date, w]));
  const outlookByDate = new Map((latest?.outlook || []).map((o) => [o.date, o]));
  const calendarByDate = new Map((forecast?.calendar || []).map((c) => [c.date, c]));
  const cannotRun = !overview.configured || running || starting || overview.cooldown_seconds > 0;

  const items = forecast?.items.filter((i) => i.trend !== 'no_sales') || [];
  const visibleItems = showAllItems ? items : items.slice(0, 10);
  const stockRows = (forecast?.ingredients || []).filter(
    (i) => showAllStock || i.is_low_stock || (i.days_of_cover !== null && i.days_of_cover <= 14) || i.suggested_order_qty > 0
  );

  return (
    <div style={styles.container} className="page-scroll fade-in">
      <p style={styles.subtitle}>
        What is selling, what is slowing down and what to stock up on, from your own sales plus the weather and local
        news around {overview.settings.location_name || 'the store'}.
      </p>

      {!overview.configured && (
        <div style={styles.hint}>
          <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span>
            AI suggestions are not set up yet. Add <code>ANTHROPIC_API_KEY</code> to <code>backend/.env</code> and restart
            the backend. The forecast and stock outlook below already work without it.
          </span>
        </div>
      )}

      {/* ---------------- AI analysis ---------------- */}
      <section className="glass-card" style={styles.card}>
        <header style={styles.cardHead}>
          <div style={{ ...styles.cardIcon, background: 'var(--accent-gold-glow)' }}>
            <Sparkles size={18} color="var(--accent-gold)" />
          </div>
          <div style={styles.cardHeadText}>
            <h3 style={styles.cardTitle}>This week's analysis</h3>
            <span style={styles.cardSub}>
              {running
                ? `Analysing sales, weather and local news… started ${ago(overview.running!.started_at)}`
                : latest
                  ? `Updated ${ago(latest.finished_at)}${latest.web_searches ? ` · ${latest.web_searches} web searches` : ''}${latest.trigger === 'scheduled' ? ' · daily run' : latest.requested_by ? ` · by ${latest.requested_by}` : ''}`
                  : 'No analysis yet'}
            </span>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={runAnalysis}
            disabled={cannotRun}
            title={
              !overview.configured
                ? 'Add ANTHROPIC_API_KEY to backend/.env first'
                : overview.cooldown_seconds > 0
                  ? `Available again in ${Math.ceil(overview.cooldown_seconds / 60)} min`
                  : undefined
            }
          >
            {running || starting ? <Loader2 size={16} className="notif-spin" /> : <RefreshCw size={16} />}
            {running ? 'Analysing…' : 'Run analysis now'}
          </button>
        </header>

        {failedNewer && !running && (
          <div style={styles.errorLine}>
            <XCircle size={16} style={{ flexShrink: 0 }} />
            <span>Last attempt failed: {overview.last_failed!.error}</span>
          </div>
        )}

        {latest?.summary && <p style={styles.summary}>{latest.summary}</p>}

        {forecast && forecast.forecast.length > 0 && (
          <div style={styles.outlookStrip}>
            {forecast.forecast.map((d, i) => {
              const w = weatherByDate.get(d.date);
              const o = outlookByDate.get(d.date);
              const c = calendarByDate.get(d.date);
              const WIcon = w ? weatherIcon(w.summary) : CalendarDays;
              const tone = o?.expectation === 'busier' ? '#10b981' : o?.expectation === 'quieter' ? '#94a3b8' : 'var(--text-muted)';
              return (
                <div key={d.date} style={styles.dayCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{i === 0 ? 'Today' : d.weekday}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{shortDate(d.date)}</span>
                  </div>
                  {w && (
                    <div style={styles.weatherLine} title={w.summary}>
                      <WIcon size={16} color="var(--text-secondary)" />
                      <span>{w.temp_max_c !== null ? `${Math.round(w.temp_max_c)}°` : ''}</span>
                      {w.rain_chance_pct !== null && <span style={{ color: 'var(--text-muted)' }}>{w.rain_chance_pct}% rain</span>}
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>~{moneyShort(d.revenue)}</div>
                  {o && (
                    <span style={{ ...styles.expectation, color: tone, borderColor: tone }}>
                      {o.expectation === 'busier' ? 'Busier' : o.expectation === 'quieter' ? 'Quieter' : 'Normal'}
                    </span>
                  )}
                  {(c?.holiday || c?.payday) && (
                    <span style={styles.calendarTag}>{c.holiday || 'Payday'}</span>
                  )}
                  {o?.note && <p style={styles.dayNote}>{o.note}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------------- Insights ---------------- */}
      {insights.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={styles.filterRow}>
            <button className={`notif-pill${kindFilter === 'all' ? ' is-on' : ''}`} onClick={() => setKindFilter('all')}>
              All ({insights.length})
            </button>
            {(Object.keys(KIND_META) as InsightKind[])
              .filter((k) => counts[k])
              .map((k) => (
                <button key={k} className={`notif-pill${kindFilter === k ? ' is-on' : ''}`} onClick={() => setKindFilter(k)}>
                  {KIND_META[k].label} ({counts[k]})
                </button>
              ))}
          </div>
          <div style={styles.grid}>
            {shown.map(({ insight, index }) => (
              <InsightCard
                key={`${latest!.id}-${index}`}
                insight={insight}
                index={index}
                rating={latest!.feedback[index]?.rating ?? null}
                itemNames={itemNames}
                ingredientById={ingredientById}
                onRate={rate}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      )}

      {latest && latest.external_factors.length > 0 && (
        <section className="glass-card" style={styles.card}>
          <header style={styles.cardHead}>
            <div style={{ ...styles.cardIcon, background: 'rgba(6,182,212,0.12)' }}>
              <Globe size={18} color="#06b6d4" />
            </div>
            <div style={styles.cardHeadText}>
              <h3 style={styles.cardTitle}>Found online</h3>
              <span style={styles.cardSub}>News, events and prices around {overview.settings.location_name || 'the store'} that matter this week</span>
            </div>
          </header>
          <ul style={styles.factorList}>
            {latest.external_factors.map((f, i) => (
              <li key={i} style={styles.factorRow}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.title}</div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{f.impact}</div>
                {f.source_url && (
                  <a href={f.source_url} target="_blank" rel="noreferrer noopener" style={styles.sourceLink}>
                    <ExternalLink size={12} />
                    {hostOf(f.source_url)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------- Forecast ---------------- */}
      {forecast && (
        <div style={styles.twoCol}>
          <section className="glass-card" style={styles.card}>
            <header style={styles.cardHead}>
              <div style={{ ...styles.cardIcon, background: 'rgba(16,185,129,0.12)' }}>
                <TrendingUp size={18} color="#10b981" />
              </div>
              <div style={styles.cardHeadText}>
                <h3 style={styles.cardTitle}>Sales forecast, next 7 days</h3>
                <span style={styles.cardSub}>From your own order history, by day of the week</span>
              </div>
            </header>
            <div style={styles.statLine}>
              <span style={styles.statChip}>Next 7 days ~{money(forecast.totals.forecast_revenue_next_7)}</span>
              <span style={styles.statChip}>
                Last 7 days {money(forecast.totals.revenue_last_7)}
                {forecast.totals.revenue_change_pct !== null && (
                  <span style={{ color: forecast.totals.revenue_change_pct >= 0 ? '#10b981' : '#ef4444' }}>
                    {' '}({forecast.totals.revenue_change_pct >= 0 ? '+' : ''}{forecast.totals.revenue_change_pct}% vs week before)
                  </span>
                )}
              </span>
              {forecast.backtest && (
                <span style={styles.statChip} title="How close last week's forecasts came to what actually sold">
                  Forecast accuracy {forecast.backtest.accuracy_pct}%
                </span>
              )}
            </div>
            <ForecastChart days={forecast.forecast} />
            {forecast.data_notes.map((n) => (
              <div key={n} style={styles.noteLine}><Info size={14} style={{ flexShrink: 0 }} /> {n}</div>
            ))}
            {forecast.signal_errors.map((n) => (
              <div key={n} style={styles.noteLine}><AlertTriangle size={14} style={{ flexShrink: 0 }} /> {n}</div>
            ))}
            {forecast.weather_effects.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={styles.fieldLabel}>Weather effects measured at your store</span>
                {forecast.weather_effects.slice(0, 4).map((e) => (
                  <div key={`${e.category}-${e.condition}`} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {e.condition === 'rainy' ? <CloudRain size={13} /> : <Sun size={13} />}{' '}
                    <strong>{e.category}</strong> sells {Math.abs(e.difference_pct)}% {e.difference_pct >= 0 ? 'more' : 'less'} on{' '}
                    {e.condition} days ({e.definition})
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-card" style={styles.card}>
            <header style={styles.cardHead}>
              <div style={{ ...styles.cardIcon, background: 'rgba(59,130,246,0.12)' }}>
                <TrendingUp size={18} color="#3b82f6" />
              </div>
              <div style={styles.cardHeadText}>
                <h3 style={styles.cardTitle}>What's selling</h3>
                <span style={styles.cardSub}>Last 7 days compared with the average week before</span>
              </div>
            </header>
            {items.length === 0 ? (
              <div style={styles.emptyInline}>No sales recorded yet.</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Item</th>
                      <th style={styles.th}>Trend</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Last 7 days</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Next 7 days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((i) => {
                      const t = TREND_META[i.trend];
                      return (
                        <tr key={i.id}>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{i.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{i.category}</div>
                          </td>
                          <td style={{ ...styles.td, color: t.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {t.label}
                            {i.change_pct !== null && (i.trend === 'rising' || i.trend === 'falling') && (
                              <span style={{ fontWeight: 400 }}> {i.change_pct > 0 ? '+' : ''}{i.change_pct}%</span>
                            )}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>{i.units_last_7}</td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>~{Math.round(i.forecast_units_next_7)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {items.length > 10 && (
              <button className="btn btn-secondary" style={styles.smallBtn} onClick={() => setShowAllItems((v) => !v)}>
                {showAllItems ? 'Show fewer' : `Show all ${items.length}`}
              </button>
            )}
          </section>
        </div>
      )}

      {forecast && (
        <div style={styles.twoCol}>
          <section className="glass-card" style={styles.card}>
            <header style={styles.cardHead}>
              <div style={{ ...styles.cardIcon, background: 'var(--accent-gold-glow)' }}>
                <PackagePlus size={18} color="var(--accent-gold)" />
              </div>
              <div style={styles.cardHeadText}>
                <h3 style={styles.cardTitle}>Stock outlook</h3>
                <span style={styles.cardSub}>When each ingredient runs out at the forecast pace, and how much to order for 10 days</span>
              </div>
            </header>
            {stockRows.length === 0 ? (
              <div style={styles.emptyInline}>Every ingredient has more than two weeks of stock.</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Ingredient</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>On hand</th>
                      <th style={styles.th}>Runs out</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.map((i) => (
                      <tr key={i.id}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{i.name}</div>
                          {i.is_low_stock && <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>Below reorder point</div>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>{qty(i.stock_level, i.unit)}</td>
                        <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                          {i.runs_out_on ? (
                            <>
                              {shortDate(i.runs_out_on)}
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{i.days_of_cover} days</div>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>{i.forecast_daily_use > 0 ? '60+ days' : 'Not used lately'}</span>
                          )}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {i.suggested_order_qty > 0 ? (
                            <>
                              {qty(Math.ceil(i.suggested_order_qty * 10) / 10, i.unit)}
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{money(i.suggested_order_cost)}</div>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button className="btn btn-secondary" style={styles.smallBtn} onClick={() => setShowAllStock((v) => !v)}>
              {showAllStock ? 'Show only what needs attention' : 'Show every ingredient'}
            </button>
          </section>

          <section className="glass-card" style={styles.card}>
            <header style={styles.cardHead}>
              <div style={{ ...styles.cardIcon, background: 'rgba(249,115,22,0.12)' }}>
                <Hourglass size={18} color="#f97316" />
              </div>
              <div style={styles.cardHeadText}>
                <h3 style={styles.cardTitle}>Likely to expire</h3>
                <span style={styles.cardSub}>Batches the forecast won't use up before their expiry date</span>
              </div>
            </header>
            {forecast.expiry_risks.length === 0 ? (
              <div style={styles.emptyInline}>Nothing is expected to expire before it is used.</div>
            ) : (
              <ul style={styles.factorList}>
                {forecast.expiry_risks.slice(0, 8).map((r) => (
                  <li key={r.batch_id} style={styles.factorRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{r.ingredient}</strong>
                      <span style={{ color: r.kind === 'expired' ? '#ef4444' : '#f97316', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {r.kind === 'expired' ? 'Expired' : r.days_left === 0 ? 'Expires today' : `Expires in ${r.days_left}d`}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Batch {r.batch_code} · {qty(r.quantity_at_risk, r.unit)} at risk ({money(r.value)})
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {forecast.expiry_risks.length > 0 && (
              <button className="btn btn-secondary" style={styles.smallBtn} onClick={() => onNavigate('stockin')}>
                Review batches
              </button>
            )}
          </section>
        </div>
      )}

      {/* ---------------- Settings ---------------- */}
      <section className="glass-card" style={styles.card}>
        <header style={styles.cardHead}>
          <div style={{ ...styles.cardIcon, background: 'rgba(124,58,237,0.12)' }}>
            <MapPin size={18} color="#7c3aed" />
          </div>
          <div style={styles.cardHeadText}>
            <h3 style={styles.cardTitle}>Location and schedule</h3>
            <span style={styles.cardSub}>Used for the weather forecast and to search local news and events</span>
          </div>
        </header>
        <form
          style={styles.addForm}
          onSubmit={(e) => {
            e.preventDefault();
            saveSettings(
              { location_name: location.name, latitude: Number(location.lat), longitude: Number(location.lon) },
              'Location saved'
            );
          }}
        >
          <label style={{ ...styles.field, flex: 2, minWidth: 200 }}>
            <span style={styles.fieldLabel}>Town or city</span>
            <input className="glass-input" value={location.name} onChange={(e) => setLocation({ ...location, name: e.target.value })} />
          </label>
          <label style={{ ...styles.field, minWidth: 110 }}>
            <span style={styles.fieldLabel}>Latitude</span>
            <input className="glass-input" inputMode="decimal" value={location.lat} onChange={(e) => setLocation({ ...location, lat: e.target.value })} />
          </label>
          <label style={{ ...styles.field, minWidth: 110 }}>
            <span style={styles.fieldLabel}>Longitude</span>
            <input className="glass-input" inputMode="decimal" value={location.lon} onChange={(e) => setLocation({ ...location, lon: e.target.value })} />
          </label>
          <button type="submit" className="btn btn-secondary" style={{ alignSelf: 'flex-end' }} disabled={savingLocation}>
            Save location
          </button>
        </form>
        <label style={styles.settingRow}>
          <div>
            <div style={styles.settingLabel}>Run the analysis every morning</div>
            <div style={styles.settingHelp}>
              Around {overview.settings.scheduled_hour}:00 ({overview.settings.timezone}). Each run costs a few cents to tens
              of cents in API usage. The nightly sales email includes the latest suggestions.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={overview.settings.ai_daily_enabled}
            aria-label="Run the analysis every morning"
            className={`notif-switch${overview.settings.ai_daily_enabled ? ' is-on' : ''}`}
            onClick={() =>
              saveSettings(
                { ai_daily_enabled: !overview.settings.ai_daily_enabled },
                overview.settings.ai_daily_enabled ? 'Daily analysis turned off' : 'Daily analysis turned on'
              )
            }
          >
            <span className="notif-switch__knob" />
          </button>
        </label>
        {overview.history.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={styles.fieldLabel}>Recent runs</span>
            {overview.history.slice(0, 5).map((r) => (
              <div key={r.id} style={styles.historyRow}>
                <span style={{ color: r.status === 'succeeded' ? '#10b981' : r.status === 'failed' ? '#ef4444' : '#3b82f6', fontWeight: 600, width: 74 }}>
                  {r.status === 'succeeded' ? 'Done' : r.status === 'failed' ? 'Failed' : 'Running'}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ago(r.started_at)} · {r.trigger === 'scheduled' ? 'daily run' : r.requested_by || 'manual'}
                  {r.status === 'failed' && r.error ? ` · ${r.error}` : ''}
                </span>
                {r.input_tokens !== null && (
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {Math.round(((r.input_tokens || 0) + (r.output_tokens || 0)) / 1000)}k tokens
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <p style={{ ...styles.settingHelp, margin: 0 }}>
          Suggestions come from Claude ({overview.model}) and are advice only. Nothing is ordered or changed automatically.
        </p>
      </section>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 },
  subtitle: { margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' },
  hint: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.88rem', color: 'var(--text-secondary)', padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', lineHeight: 1.5 },
  errorLine: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.88rem', color: '#ef4444', padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 16 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 16 },
  card: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  cardIcon: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardHeadText: { flex: '1 1 180px', minWidth: 0 },
  cardTitle: { margin: 0, fontSize: '1rem', color: 'var(--text-primary)' },
  cardSub: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  summary: { margin: 0, fontSize: '1rem', lineHeight: 1.6, color: 'var(--text-primary)', padding: '12px 14px', borderLeft: '4px solid var(--accent-gold)', background: 'var(--surface-muted)', borderRadius: '0 10px 10px 0' },
  outlookStrip: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 8 },
  dayCard: { display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 12, background: 'var(--surface-muted)', border: '1px solid var(--border-glass)', minWidth: 0 },
  weatherLine: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' },
  expectation: { alignSelf: 'flex-start', fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: 999, border: '1px solid' },
  calendarTag: { alignSelf: 'flex-start', fontSize: '0.7rem', fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: 'rgba(124,58,237,0.15)', color: 'var(--text-secondary)' },
  dayNote: { margin: 0, fontSize: '0.75rem', lineHeight: 1.4, color: 'var(--text-muted)' },
  filterRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  insightCard: { padding: 18, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  kindBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, border: '1px solid', textTransform: 'uppercase', letterSpacing: '0.03em' },
  confidence: { fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' },
  insightTitle: { margin: 0, fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.35 },
  insightDetail: { margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.55 },
  actionBox: { fontSize: '0.86rem', color: 'var(--text-primary)', padding: '8px 12px', borderLeft: '3px solid', background: 'var(--surface-muted)', borderRadius: '0 8px 8px 0', lineHeight: 1.5 },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { fontSize: '0.75rem', padding: '3px 9px', borderRadius: 999, border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' },
  evidence: { margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 },
  sourceRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  sourceLink: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--accent-gold)', textDecoration: 'none' },
  insightFoot: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--border-glass)' },
  smallBtn: { alignSelf: 'flex-start', padding: '6px 12px', fontSize: '0.82rem' },
  factorList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  factorRow: { display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-muted)' },
  statLine: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  statChip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: 'var(--surface-muted)', color: 'var(--text-secondary)' },
  tooltip: { position: 'absolute', top: 0, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', borderRadius: 8, background: 'var(--tooltip-bg)', border: '1px solid var(--border-glass)', fontSize: '0.78rem', color: 'var(--text-primary)', pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: 'var(--card-shadow)' },
  noteLine: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' },
  tableWrap: { overflowX: 'auto', margin: '0 -4px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { textAlign: 'left', padding: '8px 6px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', borderBottom: '1px solid var(--table-border)' },
  td: { padding: '8px 6px', borderBottom: '1px solid var(--table-border)', color: 'var(--text-secondary)', verticalAlign: 'top' },
  emptyInline: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.9rem' },
  empty: { padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' },
  addForm: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', padding: 14, borderRadius: 12, background: 'var(--surface-muted)' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  fieldLabel: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  settingRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-muted)', cursor: 'pointer' },
  settingLabel: { fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' },
  settingHelp: { fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45 },
  historyRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '4px 0' }
};
