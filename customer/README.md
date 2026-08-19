# Break & Brews — customer portal

The guest-facing ordering app: browse the menu, customise a drink, place an order, and follow it live
from the counter. Vite + React 19 + TypeScript, no router and no state library.

```bash
npm install
npm run dev      # http://localhost:5176
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

It talks to the Flask API at `http://localhost:5000/api` (`API_URL` in `src/lib/catalog.ts`), so the
backend must be running. `docker compose up` from the repo root starts everything together.

## Layout

```
src/
  App.tsx              all data state, fetching and handlers; passes props down
  types.ts             mirrors the backend to_dict() shapes, plus client-only cart/checkout types
  index.css            the whole theme — tokens, components, responsive rules
  lib/
    catalog.ts         API base, money/date formatting, imagery, category icons, live stock maths
    storage.ts         failure-tolerant localStorage helpers
    useDialogBehavior.ts  Escape-to-close, scroll lock and focus handling for the sheet and drawer
  components/          presentational views and pieces
```

## Things worth knowing

- **Availability is computed on the client.** `GET /api/ingredients` plus each menu item's recipe give
  the number of servings still makeable; the cart's own reservations are subtracted so two views never
  double-count the same stock. That drives the "Only N left" / "Sold out" pills and caps the quantity
  stepper. The backend is still the authority — if it rejects an order, its message is shown verbatim.
- **The multiplier table** (`None` 0.0, `Less` 0.5, `Regular` 1.0, `Extra` 1.5) is duplicated from
  `backend/app.py`. Change both.
- **Money is `$0.00`**, matching the admin and staff portals.
- **Server timestamps are naive UTC.** Parse them with `parseServerTime()`, never `new Date()` directly.
- **What persists in `localStorage`**: cart, favourites, checkout details, active order id, recent order
  ids, and per-order name/table/payment. The last one exists because the `orders` table has no columns
  for it — it is display-only and never leaves the browser.
- **Polling, not sockets**: the catalog refreshes every 10s, the active order every 3s.
