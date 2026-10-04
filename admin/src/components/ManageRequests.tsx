import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import type { Ingredient, MenuItem, Order } from '../types';

interface ManageRequestsProps {
  orders: Order[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
}

type CustomLevel = 'None' | 'Less' | 'Regular' | 'Extra';

const LEVELS: CustomLevel[] = ['Less', 'Regular', 'Extra'];
const PARSE_LEVELS: CustomLevel[] = ['None', 'Less', 'Regular', 'Extra'];
const MULTIPLIER: Record<CustomLevel, number> = {
  None: 0,
  Less: 0.5,
  Regular: 1,
  Extra: 1.5
};

interface UsageLine {
  key: string;
  orderId: number;
  createdAt: string;
  menuItemName: string;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  level: CustomLevel;
  servings: number;
  taken: number;
}

interface IngredientUsage {
  ingredientId: number;
  name: string;
  unit: string;
  remaining: number;
  byLevel: Record<CustomLevel, { servings: number; taken: number }>;
  totalTaken: number;
  customizedTaken: number;
  lines: UsageLine[];
}

function asLevel(value: string | undefined): CustomLevel {
  return PARSE_LEVELS.includes(value as CustomLevel) ? (value as CustomLevel) : 'Regular';
}

function formatQty(amount: number, unit: string): string {
  const piece = /pcs?|piece/i.test(unit);
  const value = piece ? Math.round(amount * 1000) / 1000 : amount;
  const text = piece && Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/\.?0+$/, '');
  return `${text} ${unit}`;
}

const PAGE_SIZES = [5, 10, 25, 50];

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const result: (number | '…')[] = [];
  for (const n of sorted) {
    const prev = result[result.length - 1];
    if (typeof prev === 'number' && n - prev > 1) result.push('…');
    result.push(n);
  }
  return result;
}

function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div style={styles.pager}>
      <label style={styles.pagerSize}>
        <span>Show</span>
        <select
          className="glass-input"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Rows per page"
          style={{ width: 72, padding: '6px 8px' }}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span>per page</span>
      </label>

      <span style={styles.pagerMeta}>
        {total === 0 ? '0 items' : `Showing ${start}–${end} of ${total}`}
      </span>

      <div style={styles.pagerBtns}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ ...styles.pagerBtn, opacity: page <= 1 ? 0.4 : 1 }}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {pageNumbers(page, totalPages).map((item, index) =>
          item === '…' ? (
            <span key={`gap-${index}`} style={styles.pagerGap}>…</span>
          ) : (
            <button
              type="button"
              key={item}
              className={`btn ${item === page ? 'btn-primary' : 'btn-secondary'}`}
              style={styles.pagerBtn}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          className="btn btn-secondary"
          style={{ ...styles.pagerBtn, opacity: page >= totalPages ? 0.4 : 1 }}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export const ManageRequests: React.FC<ManageRequestsProps> = ({
  orders,
  menuItems,
  ingredients
}) => {
  const [query, setQuery] = useState('');
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [customizedOnly, setCustomizedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);

  const menuById = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems]);
  const ingredientById = useMemo(
    () => new Map(ingredients.map((ing) => [ing.id, ing])),
    [ingredients]
  );

  const usage = useMemo(() => {
    const map = new Map<number, IngredientUsage>();

    const ensure = (ingredientId: number, name: string, unit: string): IngredientUsage => {
      let row = map.get(ingredientId);
      if (!row) {
        row = {
          ingredientId,
          name,
          unit,
          remaining: ingredientById.get(ingredientId)?.stock_level ?? 0,
          byLevel: {
            None: { servings: 0, taken: 0 },
            Less: { servings: 0, taken: 0 },
            Regular: { servings: 0, taken: 0 },
            Extra: { servings: 0, taken: 0 }
          },
          totalTaken: 0,
          customizedTaken: 0,
          lines: []
        };
        map.set(ingredientId, row);
      }
      return row;
    };

    for (const order of orders) {
      if (order.status === 'cancelled') continue;
      for (const item of order.items || []) {
        const recipe = menuById.get(item.menu_item_id)?.ingredients || [];
        const chosen = new Map(
          (item.customizations || []).map((c) => [c.ingredient_id, asLevel(c.level)])
        );

        for (const part of recipe) {
          if (!part.is_customizable) continue;
          const level = chosen.get(part.ingredient_id) ?? 'Regular';
          const baseQty =
            item.size === 'Small'
              ? part.qty_small ?? part.default_quantity * 0.75
              : item.size === 'Large'
                ? part.qty_large ?? part.default_quantity * 1.25
                : item.size === 'Medium'
                  ? part.qty_medium ?? part.default_quantity
                  : part.default_quantity;
          const taken = item.quantity * baseQty * MULTIPLIER[level];
          const row = ensure(part.ingredient_id, part.name, part.unit);
          row.byLevel[level].servings += item.quantity;
          row.byLevel[level].taken += taken;
          row.totalTaken += taken;
          if (level !== 'Regular') row.customizedTaken += taken;
          row.lines.push({
            key: `${order.id}-${item.id}-${part.ingredient_id}`,
            orderId: order.id,
            createdAt: order.created_at,
            menuItemName: item.menu_item_name || 'Item',
            ingredientId: part.ingredient_id,
            ingredientName: part.name,
            unit: part.unit,
            level,
            servings: item.quantity,
            taken
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalTaken - a.totalTaken);
  }, [orders, menuById, ingredientById]);

  const filtered = usage.filter((row) => {
    const matchesQuery = row.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesMode = customizedOnly ? row.customizedTaken > 0 : row.totalTaken > 0;
    return matchesQuery && matchesMode;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const tracking = usage.find((row) => row.ingredientId === trackingId) || null;
  const logTotal = tracking?.lines.length ?? 0;
  const logTotalPages = Math.max(1, Math.ceil(logTotal / logPageSize));
  const safeLogPage = Math.min(logPage, logTotalPages);
  const pagedLines = tracking
    ? tracking.lines.slice((safeLogPage - 1) * logPageSize, safeLogPage * logPageSize)
    : [];

  useEffect(() => {
    setPage(1);
  }, [query, customizedOnly, pageSize]);

  useEffect(() => {
    setLogPage(1);
  }, [trackingId, logPageSize]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    if (logPage !== safeLogPage) setLogPage(safeLogPage);
  }, [logPage, safeLogPage]);

  return (
    <div style={styles.container} className="page-scroll fade-in">
      <div style={styles.header}>
        <div style={styles.filterGroup}>
          <Search size={16} color="var(--text-muted)" />
          <input
            className="glass-input"
            placeholder="Search ingredient…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 220 }}
          />
        </div>
        <button
          type="button"
          className={`btn ${customizedOnly ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCustomizedOnly((current) => !current)}
        >
          <SlidersHorizontal size={16} />
          <span>{customizedOnly ? 'Customized only' : 'All customer usage'}</span>
        </button>
      </div>

      {tracking && (
        <div className="glass-card" style={styles.tracker}>
          <div style={styles.trackerHead}>
            <div>
              <h3 style={styles.trackerTitle}>{tracking.name} usage</h3>
              <p style={styles.trackerSub}>
                Stock taken from customer orders, including Less / Extra customizations.
              </p>
            </div>
            <span style={styles.trackerTotal}>
              {formatQty(tracking.totalTaken, tracking.unit)} taken
            </span>
          </div>

          <div style={styles.levelGrid}>
            {LEVELS.map((level) => (
              <div key={level} style={styles.levelCard}>
                <span style={styles.levelLabel}>{level}</span>
                <span style={styles.levelValue}>
                  {formatQty(tracking.byLevel[level].taken, tracking.unit)}
                </span>
                <span style={styles.levelMeta}>
                  {tracking.byLevel[level].servings} serving
                  {tracking.byLevel[level].servings === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>

          <table className="crud-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Item</th>
                <th>Customization</th>
                <th>Qty</th>
                <th>Stock taken</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {pagedLines.map((line) => (
                <tr key={line.key}>
                  <td style={{ fontWeight: 600 }}>#{line.orderId}</td>
                  <td>{line.menuItemName}</td>
                  <td>
                    <span style={{
                      ...styles.levelBadge,
                      color: line.level === 'Extra' ? '#f59e0b' : line.level === 'None' || line.level === 'Less' ? '#60a5fa' : 'var(--text-primary)'
                    }}>
                      {line.level}
                    </span>
                  </td>
                  <td>{line.servings}</td>
                  <td style={{ fontWeight: 700, color: '#f59e0b' }}>
                    {formatQty(line.taken, line.unit)}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Calendar size={12} />
                      <span>{new Date(line.createdAt).toLocaleString()}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar
            page={safeLogPage}
            pageSize={logPageSize}
            total={logTotal}
            onPageChange={setLogPage}
            onPageSizeChange={setLogPageSize}
          />
        </div>
      )}

      <div className="glass-card" style={{ padding: 0 }}>
        <div className="table-scroll">
        <table className="crud-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Remaining stock</th>
              <th>Taken from customers</th>
              <th>From customizations</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No customer customization stock has been deducted yet.
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr key={row.ingredientId}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                  <td>{formatQty(row.remaining, row.unit)}</td>
                  <td style={{ fontWeight: 700, color: '#f59e0b' }}>
                    {formatQty(row.totalTaken, row.unit)}
                  </td>
                  <td>
                    {row.customizedTaken > 0
                      ? formatQty(row.customizedTaken, row.unit)
                      : <span style={{ color: 'var(--text-muted)' }}>Regular only</span>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '6px 12px' }}
                      onClick={() =>
                        setTrackingId((current) =>
                          current === row.ingredientId ? null : row.ingredientId
                        )
                      }
                    >
                      {trackingId === row.ingredientId ? 'Hide tracker' : 'Track usage'}
                      <ChevronDown
                        size={14}
                        style={{
                          transform: trackingId === row.ingredientId ? 'rotate(180deg)' : undefined,
                          transition: 'transform 0.15s ease'
                        }}
                      />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <PaginationBar
          page={safePage}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
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
    minHeight: 0,
    flex: 1
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '16px'
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  tracker: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  },
  trackerHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap' as const
  },
  trackerTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  trackerSub: {
    margin: '4px 0 0',
    fontSize: '0.85rem',
    color: 'var(--text-muted)'
  },
  trackerTotal: {
    fontWeight: 800,
    color: '#f59e0b',
    fontSize: '1rem'
  },
  levelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px'
  },
  levelCard: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid var(--border-glass)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4
  },
  levelLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const
  },
  levelValue: {
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  levelMeta: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  levelBadge: {
    fontWeight: 700,
    fontSize: '0.85rem'
  },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap' as const,
    padding: '12px 16px',
    borderTop: '1px solid var(--border-glass)'
  },
  pagerSize: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: 600
  },
  pagerMeta: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: 600
  },
  pagerBtns: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  pagerBtn: {
    minWidth: 36,
    height: 36,
    padding: '0 10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pagerGap: {
    color: 'var(--text-muted)',
    padding: '0 4px'
  }
};
