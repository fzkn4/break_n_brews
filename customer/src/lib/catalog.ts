import {
  Beer,
  Coffee,
  Croissant,
  CupSoda,
  Salad,
  Sandwich,
  Snowflake,
  Soup,
  Sparkles,
  UtensilsCrossed
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CartItem, CustomizationLevel, Ingredient, MenuItem } from '../types';

export const API_URL = 'http://localhost:5000/api';

/** Kept in sync with the multiplier table in backend/app.py `place_order()`. */
export const CUSTOMIZATION_LEVELS: CustomizationLevel[] = ['None', 'Less', 'Regular', 'Extra'];

export const LEVEL_MULTIPLIER: Record<CustomizationLevel, number> = {
  None: 0.0,
  Less: 0.5,
  Regular: 1.0,
  Extra: 1.5
};

/** Admin and staff portals both render money as `$0.00`; the customer sees the same figure. */
export function formatPrice(amount: number): string {
  return `$${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
}

export function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// ----- Imagery -------------------------------------------------------------

/** Shown only when a menu item has no `image_url` in the database at all. */
export const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80';

/** Product imagery lives in `menu_items.image_url`; the admin portal is where it is set. */
export function productImage(item: Pick<MenuItem, 'image_url'>): string {
  return item.image_url?.trim() || FALLBACK_IMAGE;
}

// ----- Categories ----------------------------------------------------------

const CATEGORY_ICONS: [RegExp, LucideIcon][] = [
  [/iced/i, Snowflake],
  [/coffee/i, Coffee],
  [/alcohol|beer|wine|drink/i, Beer],
  [/snack|pastr|dessert/i, Croissant],
  [/platter/i, UtensilsCrossed],
  [/rice bowl/i, Soup],
  [/rice|meal/i, Salad],
  [/tea|juice|soda|non/i, CupSoda],
  [/sandwich|burger/i, Sandwich]
];

export function categoryIcon(category: string): LucideIcon {
  if (category === 'All') return Sparkles;
  const match = CATEGORY_ICONS.find(([pattern]) => pattern.test(category));
  return match ? match[1] : Coffee;
}

/** Categories are whatever the admin has actually used, so new ones show up without a code change. */
export function categoriesFrom(items: MenuItem[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const key = item.category.toLowerCase();
    if (!seen.has(key)) seen.set(key, titleCase(item.category));
  }
  return ['All', ...seen.values()];
}

// ----- Descriptions --------------------------------------------------------

/** A real description beats filler: list what actually goes into the cup. */
export function describeItem(item: MenuItem): string {
  const parts = item.ingredients
    .filter((ing) => !/cup|straw|packag|lid|napkin/i.test(ing.name))
    .map((ing) => ing.name.replace(/\s*\(.*?\)\s*/g, '').trim());
  if (parts.length === 0) return 'Prepared fresh to order by our baristas.';
  if (parts.length <= 3) return `Made with ${formatList(parts)}.`;
  return `Made with ${formatList(parts.slice(0, 3))} and ${parts.length - 3} more.`;
}

function formatList(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// ----- Live availability ---------------------------------------------------

export type StockMap = Map<number, number>;

export function stockMapFrom(ingredients: Ingredient[]): StockMap {
  return new Map(ingredients.map((ing) => [ing.id, ing.stock_level]));
}

/** How much of each ingredient one serving of `item` consumes at the given customization levels. */
export function requirementsFor(
  item: MenuItem,
  levels: Record<number, CustomizationLevel> = {}
): Map<number, number> {
  const needs = new Map<number, number>();
  for (const recipe of item.ingredients) {
    const level = recipe.is_customizable ? levels[recipe.ingredient_id] ?? 'Regular' : 'Regular';
    const needed = recipe.default_quantity * LEVEL_MULTIPLIER[level];
    if (needed > 0) needs.set(recipe.ingredient_id, (needs.get(recipe.ingredient_id) ?? 0) + needed);
  }
  return needs;
}

/** Everything the current cart has already spoken for, so the two views never double-count stock. */
export function reservedByCart(cart: CartItem[], menuById: Map<number, MenuItem>): Map<number, number> {
  const reserved = new Map<number, number>();
  for (const line of cart) {
    const item = menuById.get(line.menuItemId);
    if (!item) continue;
    const levels: Record<number, CustomizationLevel> = {};
    for (const custom of line.customizations) levels[custom.ingredient_id] = custom.level;
    for (const [id, perServing] of requirementsFor(item, levels)) {
      reserved.set(id, (reserved.get(id) ?? 0) + perServing * line.quantity);
    }
  }
  return reserved;
}

/**
 * Servings still makeable with the stock on hand. `Infinity` means the recipe is empty (nothing to
 * run out of); the caller decides what to show. Floating point stock is rounded down defensively so
 * we never promise a serving the backend would reject.
 */
export function servingsAvailable(
  item: MenuItem,
  stock: StockMap,
  reserved: Map<number, number> = new Map(),
  levels: Record<number, CustomizationLevel> = {}
): number {
  const needs = requirementsFor(item, levels);
  if (needs.size === 0) return Infinity;
  let servings = Infinity;
  for (const [ingredientId, perServing] of needs) {
    const onHand = stock.get(ingredientId);
    if (onHand === undefined) continue; // ingredient list not loaded yet — do not block ordering
    const free = onHand - (reserved.get(ingredientId) ?? 0);
    servings = Math.min(servings, Math.floor((free + 1e-9) / perServing));
  }
  return Math.max(0, servings);
}

export type Availability =
  | { kind: 'unavailable' }
  | { kind: 'sold_out' }
  | { kind: 'low'; left: number }
  | { kind: 'ok' };

export function availabilityOf(item: MenuItem, stock: StockMap, reserved: Map<number, number>): Availability {
  if (!item.is_available) return { kind: 'unavailable' };
  if (stock.size === 0) return { kind: 'ok' }; // stock unknown; let the backend be the judge
  const left = servingsAvailable(item, stock, reserved);
  if (left <= 0) return { kind: 'sold_out' };
  if (left <= 5) return { kind: 'low', left };
  return { kind: 'ok' };
}

// ----- Cart helpers --------------------------------------------------------

export function cartLineId(menuItemId: number, levels: Record<number, CustomizationLevel>): string {
  const key = Object.entries(levels)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, level]) => `${id}:${level}`)
    .join('-');
  return key ? `${menuItemId}-${key}` : `${menuItemId}`;
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function cartCount(cart: CartItem[]): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

export function summariseCustomizations(customs: { name: string; level: string }[]): string {
  const notable = customs.filter((c) => c.level !== 'Regular');
  if (notable.length === 0) return 'Standard recipe';
  return notable.map((c) => `${c.level} ${c.name}`).join(' · ');
}

// ----- Timestamps ----------------------------------------------------------

/**
 * The backend serialises `datetime.utcnow().isoformat()`, which carries no zone designator —
 * `new Date()` would read it as local time and report a fresh order as hours old.
 */
export function parseServerTime(iso: string): Date {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`);
}
