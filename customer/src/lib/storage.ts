/** Typed, failure-tolerant localStorage helpers (private mode / disabled storage must not crash the app). */

export const STORAGE_KEYS = {
  cart: 'bb_cart',
  favorites: 'bb_favorites',
  activeOrder: 'bb_active_order_id',
  orderHistory: 'bb_order_history',
  orderMeta: 'bb_order_meta',
  checkout: 'bb_checkout_details'
} as const;

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStore(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — the app still works, it just will not remember */
  }
}

export function clearStore(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
