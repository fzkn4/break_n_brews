import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const STORAGE_KEY = 'bb_customer_origin';
const COUNT_STORAGE_KEY = 'bb_table_count';

function QrCard({ url, table }: { url: string; table: number }) {
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

  return (
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
  );
}

export const TableQrCodes = () => {
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [tableCount, setTableCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(COUNT_STORAGE_KEY);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 40) return parsed;
      }
    } catch {
      /* fallback to default */
    }
    return 8;
  });

  useEffect(() => {
    if (baseUrl) return;
    fetch(`${API_URL}/lan`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.customer_url) setBaseUrl(data.customer_url);
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

  const origin = baseUrl.trim().replace(/\/$/, '');
  const tables = Array.from({ length: Math.max(1, Math.min(tableCount, 40)) }, (_, index) => index + 1);

  return (
    <div className="qr-page page-scroll">
      <div className="qr-page__head no-print">
        <div>
          <h1>Table QR Codes</h1>
          <p>
            Print one card per table. A phone on the same Wi-Fi opens the menu for that table, and the kitchen ticket shows the table number.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!origin}>
          <Printer size={16} />
          Print cards
        </button>
      </div>

      <div className="qr-page__setup no-print">
        <label>
          Customer menu address
          <input
            className="glass-input"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="http://192.168.1.20:5176"
          />
        </label>
        <label>
          Number of tables
          <input
            className="glass-input"
            type="number"
            min={1}
            max={40}
            value={tableCount}
            onChange={(event) => setTableCount(Math.max(1, Math.min(40, Number(event.target.value) || 1)))}
          />
        </label>
      </div>

      {!origin ? (
        <p className="no-print">Enter the address phones will use to open the menu. It cannot be localhost if the phone is doing the scanning.</p>
      ) : (
        <div className="qr-grid">
          {tables.map((table) => (
            <QrCard key={table} table={table} url={`${origin}/?table=${table}`} />
          ))}
        </div>
      )}
    </div>
  );
};
