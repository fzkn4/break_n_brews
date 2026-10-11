import type { ExpiryStatus, StockBatch } from '../types';

/** Backend timestamps are naive UTC; `new Date(iso)` alone would read them as local time. */
export function parseServerTime(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

/** 'YYYY-MM-DD' as a local calendar date (not UTC midnight). */
export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayInput(): string {
  return toDateInput(new Date());
}

export function addDaysInput(days: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return toDateInput(d);
}

export function daysUntil(value: string): number | null {
  const target = parseDateOnly(value);
  if (!target) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function statusForDays(days: number | null): ExpiryStatus {
  if (days === null) return 'unknown';
  if (days < 0) return 'expired';
  if (days <= 2) return 'critical';
  if (days <= 7) return 'soon';
  return 'ok';
}

export function formatExpiry(value: string | null): string {
  const d = value ? parseDateOnly(value) : null;
  if (!d) return 'Not recorded';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function expiryLabel(days: number | null): string {
  if (days === null) return 'No expiry recorded';
  if (days < -1) return `Expired ${-days} days ago`;
  if (days === -1) return 'Expired yesterday';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

export const EXPIRY_TONE: Record<ExpiryStatus, { color: string; bg: string; border: string; label: string }> = {
  expired: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', label: 'Expired' },
  critical: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.35)', label: 'Use now' },
  soon: { color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', border: 'rgba(217, 119, 6, 0.3)', label: 'This week' },
  ok: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', label: 'Fresh' },
  unknown: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.14)', border: 'rgba(148, 163, 184, 0.35)', label: 'No date' },
};

export function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

/** Batches that need attention today: expired, or expiring within 2 days. Used for nav badges. */
export const urgentBatchCount = (batches: StockBatch[]) =>
  batches.filter((b) => b.state === 'active' && (b.expiry_status === 'expired' || b.expiry_status === 'critical')).length;
