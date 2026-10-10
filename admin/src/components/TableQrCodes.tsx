import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import QRCode from 'qrcode';
import { Check, CheckCheck, Download, ExternalLink, Minus, Plus, Printer, QrCode, Wifi, X } from 'lucide-react';
import { STORAGE_KEYS, readStore, writeStore } from '../lib/storage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const STORAGE_KEY = 'bb_customer_origin';
const COUNT_STORAGE_KEY = 'bb_table_count';
const MAX_TABLES = 40;

function useQrDataUrl(url: string): string {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 512, margin: 1, errorCorrectionLevel: 'M' })
      .then((next) => {
        if (!cancelled) setDataUrl(next);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return dataUrl;
}

function QrCard({ url, table, onRemove }: { url: string; table: number; onRemove: () => void }) {
  const dataUrl = useQrDataUrl(url);

  return (
    <div className="qr-card-wrap">
      <article className="qr-card">
        <header className="qr-card__brand">
          <span className="qr-card__mark">Break &amp; Brews</span>
          <span className="qr-card__place">Billiards Café</span>
        </header>
        <div className="qr-card__code">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code for table ${table}`} />
          ) : (
            <div className="qr-card__blank" />
          )}
        </div>
        <p className="qr-card__kicker">Table</p>
        <p className="qr-card__number">{table}</p>
        <p className="qr-card__action">Scan to order</p>
        <p className="qr-card__hint">Open your camera and point it at this code.</p>
      </article>
      <div className="qr-card__tools no-print">
        <a
          className="qr-tool"
          href={dataUrl || undefined}
          download={`break-and-brews-table-${table}.png`}
          aria-disabled={!dataUrl}
          title="Download QR as PNG"
        >
          <Download size={15} />
        </a>
        <a className="qr-tool" href={url} target="_blank" rel="noreferrer" title="Open the menu link for this table">
          <ExternalLink size={15} />
        </a>
        <button type="button" className="qr-tool" onClick={onRemove} title={`Remove table ${table} from this print`}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

export const TableQrCodes = () => {
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [detected, setDetected] = useState(false);
  const [tableCount, setTableCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(COUNT_STORAGE_KEY);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= MAX_TABLES) return parsed;
      }
    } catch {
      /* fallback to default */
    }
    return 8;
  });
  const [selected, setSelected] = useState<number[]>(() => {
    const saved = readStore<unknown>(STORAGE_KEYS.qrCodes, []);
    return Array.isArray(saved) ? saved.filter((n): n is number => Number.isInteger(n) && n >= 1) : [];
  });
  /** Anchor for shift-click range selection. */
  const [lastClicked, setLastClicked] = useState<number | null>(null);

  useEffect(() => {
    if (baseUrl) return;
    fetch(`${API_URL}/lan`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.customer_url) {
          setBaseUrl(data.customer_url);
          setDetected(true);
        }
      })
      .catch(() => {
        /* the field stays editable so a tester can type the address */
      });
  }, [baseUrl]);

  useEffect(() => {
    if (baseUrl) localStorage.setItem(STORAGE_KEY, baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    localStorage.setItem(COUNT_STORAGE_KEY, String(tableCount));
  }, [tableCount]);

  useEffect(() => {
    writeStore(STORAGE_KEYS.qrCodes, selected);
  }, [selected]);

  const origin = baseUrl.trim().replace(/\/$/, '');
  const tables = useMemo(() => Array.from({ length: tableCount }, (_, index) => index + 1), [tableCount]);
  /** Tables removed by lowering the count drop out of the print too. */
  const printable = useMemo(
    () => [...new Set(selected)].filter((t) => t <= tableCount).sort((a, b) => a - b),
    [selected, tableCount]
  );
  const allSelected = printable.length === tableCount;

  const toggleTable = (table: number, event: MouseEvent) => {
    if (event.shiftKey && lastClicked !== null) {
      const [from, to] = lastClicked < table ? [lastClicked, table] : [table, lastClicked];
      const range = tables.filter((t) => t >= from && t <= to);
      // Shift-click follows the anchor: extend a selection, or clear a run when the anchor is off.
      const turnOn = printable.includes(lastClicked);
      setSelected((prev) =>
        turnOn ? [...new Set([...prev, ...range])] : prev.filter((t) => !range.includes(t))
      );
    } else {
      setSelected((prev) => (prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]));
    }
    setLastClicked(table);
  };

  const changeCount = (delta: number) => setTableCount((n) => Math.max(1, Math.min(MAX_TABLES, n + delta)));

  const printLabel =
    printable.length === 0
      ? 'Print cards'
      : `Print ${printable.length} card${printable.length === 1 ? '' : 's'}`;

  return (
    <div className="qr-page page-scroll">
      <div className="qr-page__head no-print">
        <div>
          <h1>Table QR Codes</h1>
          <p>
            Pick the tables that need a card, check the preview, then print. A phone on the same Wi-Fi opens the menu
            for that table, and the kitchen ticket shows the table number.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
          disabled={!origin || printable.length === 0}
          title={!origin ? 'Set the customer menu address first' : printable.length === 0 ? 'Select at least one table' : undefined}
        >
          <Printer size={16} />
          {printLabel}
        </button>
      </div>

      <section className="qr-panel no-print" aria-labelledby="qr-setup-title">
        <h2 id="qr-setup-title" className="qr-panel__title">Setup</h2>
        <div className="qr-setup">
          <label className="qr-field qr-field--grow">
            <span className="qr-field__label">
              Customer menu address
              {detected && (
                <span className="qr-badge">
                  <Wifi size={12} /> Detected on this network
                </span>
              )}
            </span>
            <input
              className="glass-input"
              value={baseUrl}
              onChange={(event) => {
                setBaseUrl(event.target.value);
                setDetected(false);
              }}
              placeholder="http://192.168.1.20:5176"
            />
            <span className="qr-field__hint">Phones open this address, so it cannot be localhost.</span>
          </label>

          <div className="qr-field">
            <span className="qr-field__label">Tables in the café</span>
            <div className="qr-stepper">
              <button type="button" onClick={() => changeCount(-1)} disabled={tableCount <= 1} aria-label="One fewer table">
                <Minus size={16} />
              </button>
              <span aria-live="polite">{tableCount}</span>
              <button
                type="button"
                onClick={() => changeCount(1)}
                disabled={tableCount >= MAX_TABLES}
                aria-label="One more table"
              >
                <Plus size={16} />
              </button>
            </div>
            <span className="qr-field__hint">Up to {MAX_TABLES} tables.</span>
          </div>
        </div>
      </section>

      <section className="qr-panel no-print" aria-labelledby="qr-pick-title">
        <div className="qr-panel__head">
          <div>
            <h2 id="qr-pick-title" className="qr-panel__title">Choose tables to print</h2>
            <p className="qr-panel__sub">
              {printable.length} of {tableCount} selected · Shift-click to select a range
            </p>
          </div>
          <div className="qr-panel__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelected(tables)}
              disabled={allSelected}
            >
              <CheckCheck size={15} />
              Select all
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelected([])}
              disabled={printable.length === 0}
            >
              <X size={15} />
              Clear
            </button>
          </div>
        </div>

        <div className="table-picker" role="group" aria-label="Tables">
          {tables.map((table) => {
            const isOn = printable.includes(table);
            return (
              <button
                key={table}
                type="button"
                className={`table-tile${isOn ? ' is-selected' : ''}`}
                aria-pressed={isOn}
                aria-label={`Table ${table}`}
                onClick={(event) => toggleTable(table, event)}
              >
                <span className="table-tile__check">{isOn && <Check size={12} strokeWidth={3} />}</span>
                <span className="table-tile__kicker">Table</span>
                <span className="table-tile__number">{table}</span>
              </button>
            );
          })}
        </div>
      </section>

      {!origin ? (
        <div className="qr-empty no-print">
          <QrCode size={28} />
          <p>Enter the customer menu address above to generate the cards.</p>
        </div>
      ) : printable.length === 0 ? (
        <div className="qr-empty no-print">
          <QrCode size={28} />
          <p>Select one or more tables to preview their cards here.</p>
        </div>
      ) : (
        <section aria-labelledby="qr-preview-title">
          <h2 id="qr-preview-title" className="qr-panel__title qr-preview__title no-print">
            Print preview · {printable.length} card{printable.length === 1 ? '' : 's'}
          </h2>
          <div className="qr-grid">
            {printable.map((table) => (
              <QrCard
                key={table}
                table={table}
                url={`${origin}/?table=${table}`}
                onRemove={() => setSelected((prev) => prev.filter((t) => t !== table))}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
