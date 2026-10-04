/**
 * Typed, failure-tolerant localStorage persistent storage helpers for Admin Portal.
 * Ensures JSON.parse fallbacks so missing or corrupted keys do not break initial rendering.
 */

export const STORAGE_KEYS = {
  ingredients: 'bb_admin_ingredients',
  menuItems: 'bb_admin_menu_items',
  requests: 'bb_admin_requests',
  orders: 'bb_admin_orders',
  stockIn: 'bb_admin_stockin',
  reviews: 'bb_admin_reviews',
  subscribers: 'bb_admin_subscribers',
  analytics: 'bb_admin_analytics',
  qrCodes: 'bb_admin_qr_codes',
} as const;

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Failed to read ${key} from localStorage:`, err);
    return fallback;
  }
}

export function writeStore<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write ${key} to localStorage:`, err);
  }
}

export function clearStore(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`Failed to clear ${key} from localStorage:`, err);
  }
}
