# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Break & Brews is a café/billiards management system: one Flask + PostgreSQL API (`backend/`) serving three
independent Vite + React 19 + TypeScript SPAs — `admin/` (inventory, menu/recipes, requests, stock-in, reports),
`staffs/` (kitchen order queue, stock-in, inventory alerts + supply requests), and `customer/` (mobile-first ordering + live order tracker).

There is no monorepo tooling. Each frontend has its own `package.json`, `node_modules`, and `package-lock.json`;
install and run each separately.

## Commands

Everything at once (PostgreSQL + API + all three portals, hot reload, ports as below):

```bash
docker compose up --build
docker compose logs -f backend
docker compose down            # -v also drops the database volume
```

Compose seeds only on first start; `SEED_ON_START=1 docker compose up -d --force-recreate backend`
forces a wipe + reseed. Host DB port defaults to 5434 (see `.env.example`) to avoid colliding with a
local PostgreSQL. `backend/init_db.py` is the container bootstrap — it waits for the DB, creates
missing tables, and only calls `seed_database()` when the schema is absent or a reseed is requested.

Backend (from `backend/`, with `source .venv/bin/activate`):

```bash
python app.py          # Runs on :5000 AND drops + recreates + reseeds the whole database first
flask run --port=5000  # Runs without touching data — requires tables to already exist
pip install -r requirements.txt
```

Frontends (from `admin/`, `staffs/`, or `customer/`):

```bash
npm install
npm run dev      # admin :5173, staffs :5174, customer :5176
npm run build    # tsc -b && vite build
npm run lint     # oxlint (config in .oxlintrc.json)
```

There is no test suite in this repo — no pytest, no vitest, no test files.

### Database gotchas

- `python app.py` calls `seed_database()` on every start, which begins with `db.drop_all()`. Any local data is
  destroyed. Use `flask run` when data must survive.
- `backend/seed.py` defines `seed_database()` but has no `if __name__ == '__main__'` block and no app context, so
  `python seed.py` (as the README instructs) silently does nothing. Seeding only happens through `python app.py`.
- Nothing else creates tables. A fresh database must be initialized by running `python app.py` at least once.
- Connection string defaults to `postgresql://postgres:password@localhost:5432/break_and_brews`, overridable via
  `DATABASE_URL` in `backend/.env`.

## Architecture

### The recipe/BOM model is the core of the domain

`MenuItemIngredient` is a join table (`menu_item_id`, `ingredient_id`, `default_quantity`, `is_customizable`) that
makes every menu item a bill of materials over `Ingredient`. Nearly every behavior in the system falls out of it:

- **Ordering deducts stock** (`POST /api/orders` in `app.py`): for each order item it walks the menu item's recipe,
  applies a customization multiplier (`None` 0.0, `Less` 0.5, `Regular` 1.0, `Extra` 1.5) to `default_quantity`, and
  subtracts the result from `Ingredient.stock_level`. Only ingredients with `is_customizable=True` accept a level;
  the rest are always `Regular`. The multiplier table is duplicated in the validation pass and the deduction pass —
  change both.
- **Stock is only pre-validated for customer orders**: the "insufficient stock" 400 fires only when the request body
  has `status: 'pending'` (what `customer/` sends). Admin/POS orders deduct unconditionally, clamped at 0.
- **Customizations are stored denormalized** as a JSON string in `OrderItem.customizations` alongside
  `price_at_order`, so historical orders survive recipe and price edits.
- Editing a menu item's recipe in `admin/` immediately changes what future orders consume; there is no versioning.
- **`customer/` mirrors the same maths client-side** (`customer/src/lib/catalog.ts`): it fetches `/api/ingredients`,
  walks each recipe, subtracts what the cart has already reserved, and uses the result to badge items "Only N left"
  or "Sold out" and cap the quantity stepper. It is a courtesy layer only — the backend still decides, and its 400
  message is shown to the customer verbatim.
- **Sized drinks also consume packaging**: `MenuItem.size_config` (JSON, e.g.
  `{"Small": {"oz": 12, "container_id": 7, "straw_id": 9}}`) links each size to a cup and straw ingredient.
  `POST /api/orders` adds one of each per unit unless the recipe already uses that ingredient — again in both the
  validation pass and the deduction pass. Admin's `ManageMenu` pre-picks them by name (`12oz`, `straw`).

### Stock batches and expiry (`backend/batches.py`, `StockBatch` in `models.py`)

- Every stock-in is one or more **batches** (`stock_batches`), each with its own `batch_code` (auto-generated
  `WM-20261011-01` style when blank (2 letters for one-word names, initials otherwise), unique per ingredient) and a required `expiry_date` that may not be in the past.
  `POST /api/stockin` takes `batches: [{quantity, batch_code, expiry_date}]`; `cost` is optional (staff) and then
  valued at the current `cost_per_unit` without changing it.
- `Ingredient.stock_level` is still the total everyone reads, but it counts **only unexpired** active batches —
  `recalculate_stock()` derives it from them, and `GET /api/ingredients` recalculates (and commits) every
  ingredient on each read so stock drops the day a batch expires. **Never assign `stock_level` directly** — use
  `consume()` / `restore()` / `reconcile()` from `batches.py`. Consumption is first-expired-first-out over dated
  batches (soonest expiry first), then undated batches (opening stock, manual adjustments) oldest first; expired
  batches are never drawn from and wait to be discarded. `GET /api/batches` returns `use_rank` (1 = open next; null for expired).
- `ensure_batch_schema()` gives existing stock an undated `OPEN-…` batch on first start; portals nudge users to add
  its expiry. `POST /api/batches/<id>/discard` writes off expired/spoiled stock; `PUT /api/batches/<id>` fixes a
  code or date. Admin "Stock In & Expiry" and the staff tab of the same name share `ReceiveStockForm` and
  `BatchQueue` (copied per portal, like `types.ts`).

Other stock movements: `POST /api/stockin` adds quantity and recomputes `cost_per_unit` from `cost / quantity`;
approving an `IngredientRequest` (`PUT /api/requests/<id>`) deducts the requested quantity and un-approving adds it
back — approval transitions, not creation, are what move stock.

### AI sales insights (`backend/forecasting.py`, `signals.py`, `insights.py`)

- **Numbers come from code, words come from Claude.** `forecasting.build_forecast()` computes per-item trends,
  a 7-day forecast (60% last-7 + 40% last-28 daily average × a shrunk day-of-week factor), ingredient demand
  through the recipes, days of cover, run-out dates, suggested order quantities and FEFO expiry risk, plus a
  walk-forward backtest. Days are business days (orders before an after-midnight closing count to the day
  before). `signals.py` adds Open-Meteo weather, Nager.Date PH holidays, paydays (15th / month end), and
  weather effects measured on the store's own history (detrended, weekday-adjusted, t-score >= 2.5, so noise
  is not reported). None of this needs an API key: `GET /api/insights/forecast`.
- `insights.py` sends that snapshot to Claude (`claude-opus-5-5`, adaptive thinking, `web_search` located at
  the store, server-side refusal fallback) and takes the answer through the `submit_insights` tool. `_validate()`
  drops unknown menu/ingredient ids and any URL web search did not return. Suggestions are advice only;
  nothing changes stock or the menu.
- Runs execute on a background thread (`POST /api/insights/refresh` returns 202, the portal polls
  `GET /api/insights`) and are stored in `ai_insight_runs`; thumbs up/down per insight (`ai_insight_feedback`)
  is fed into the next prompt. One daily run per store-local date after `AI_INSIGHTS_HOUR` is claimed via
  `store_settings.last_insight_key` from the notifications scheduler tick; manual runs have a cooldown because
  each costs money. The latest run (36h or newer) is added to the end-of-day email.
- `ANTHROPIC_API_KEY` lives only in `backend/.env`; without it `configured: false` and only the AI part is off.
  Store location (`location_name`, `latitude`, `longitude`) defaults to Pagadian City and is edited in admin's
  Sales Insights tab. The new `store_settings` columns are added by `ensure_store_settings_columns()`, which
  must run before anything reads `StoreSettings` (every query selects all mapped columns).

### Cross-portal "real time" is polling, not sockets

All three portals `setInterval` against the same REST API and re-fetch everything: admin and staffs every 5s,
customer's order tracker every 3s. The order lifecycle spans portals — customer POSTs an order with
`status: 'pending'` → staff sees it in `OrderQueue` and PUTs `preparing`/`completed`/`cancelled` → customer's
tracker picks the change up on its next poll. Stock deductions ripple into the admin dashboard the same way.
Valid order statuses are enforced server-side: `pending`, `preparing`, `completed`, `cancelled`.

### Reviews are moderated, not live

`POST /api/reviews` (what `customer/` sends after an order completes) always stores `is_published=False`
unless the caller explicitly passes `is_published`. `GET /api/reviews` returns published rows only; admin
asks for `?all=1` to see the queue and `PUT /api/reviews/<id>` to publish. One review per `order_id` is
enforced server-side, so a guest cannot flood the wall from a single visit. The customer portal also
remembers which orders it has reviewed in `bb_reviewed_orders` to hide the prompt after submitting.

### Email notifications (`backend/notifications.py`, `mailer.py`, `daily_report.py`)

- Gmail SMTP credentials come **only** from `SMTP_USER` / `SMTP_APP_PASSWORD` in `backend/.env` (see
  `backend/.env.example`). They are never stored in the DB or returned by the API; `/api/notifications/settings`
  exposes only `configured` and a masked sender. Recipients, toggles, closing time and time zone live in the DB
  (`notification_recipients`, single-row `store_settings`) and are edited in admin's Email Notifications tab.
- Low stock = `stock_level <= reorder_point` (`is_low_stock()`). `safe_check_low_stock()` runs after every stock
  change and emails once per ingredient (`Ingredient.low_stock_alerted_at`), re-arming after a restock.
- **Auto-pause:** while any recipe ingredient is low, `MenuItem.to_dict()` reports `stock_paused: true` and
  `POST /api/orders` rejects the item. This is separate from the manual `is_available` switch and lifts on restock.
  Customer and staff portals show "Unavailable at the moment".
- The end-of-day report is sent by a background thread (started on the first request) shortly after the store's
  closing time. A business day is the 24h ending at closing. `store_settings.last_report_key` is claimed with a
  conditional UPDATE, so the debug reloader's second process cannot double-send. Every send is recorded in
  `email_logs`, and delivery runs on a thread so requests never wait on Gmail.

### Frontend conventions

- Each portal is a single stateful `App.tsx` holding all data state and all fetch handlers, passing them down as
  props to presentational components. No router, no state library, no data-fetching library — `activeTab` string
  state switches views.
- `const API_URL = 'http://localhost:5000/api'` is hardcoded at the top of each `App.tsx` — except `customer/`,
  which keeps it in `src/lib/catalog.ts` alongside its formatting and stock helpers.
- Auth is client-side only: `POST /api/login` returns `{name, email, role}`, which is stashed in `localStorage`
  (`bb_admin_user` / `bb_staff_user`). No tokens, no session, and no API endpoint checks a role. The `customer/`
  portal has no login; it keeps cart, favourites, checkout details, active order id, recent order ids and
  per-order name/table/payment under `bb_*` keys in `localStorage` (see `customer/src/lib/storage.ts`).
- Styling is a mix: shared layout/component classes live in `index.css` (dark theme by default, `.light-theme` on
  `<html>` toggles light in admin), while per-element layout is frequently written as inline `style={{}}` objects.
  Match whichever the surrounding file uses. `customer/` is the exception — it is fully class-based off the
  dark matte tokens in its own `index.css`, with breakpoints at 900/780/520px and a mobile tab bar; keep new
  customer markup on classes rather than inline styles.
- Money renders as `$0.00` in all three portals.
- Backend timestamps are naive UTC (`datetime.utcnow().isoformat()`, no `Z`). `customer/` parses them through
  `parseServerTime()`; anywhere else `new Date(iso)` silently reads them as local time.
- `types.ts` mirrors the backend `to_dict()` shapes and is **duplicated and divergent** across `admin/`,
  `staffs/` and `customer/` (admin has `AnalyticsData`/`ReportData` and recipe fields; staffs has
  `Order`/`OrderItem`; customer adds cart and checkout shapes). When a model changes, update every portal's
  copy that uses it.
- All fetches are guarded with `if (res.ok)`, so a failing endpoint degrades to empty state silently with nothing
  in the UI to say so. Check the network tab before concluding a list is genuinely empty.
- **No portal hardcodes catalog or storefront content.** Menu items, prices, product imagery
  (`menu_items.image_url`), recipes, menu categories, ingredient categories and units, plus the home page
  testimonials, all come from the API. Admin's category and unit fields are free text backed by a `<datalist>`
  of the values already in the database, so a new category needs no code change and shows up in the customer
  portal's rail on its next poll.

### API surface (`backend/app.py`, ~600 lines, all routes in one file)

`/api/ingredients`, `/api/menu`, `/api/requests`, `/api/stockin`, `/api/staff`, `/api/orders`, `/api/reviews`
(CRUD subsets), plus `/api/login`, `/api/subscribers` (newsletter signups), `/api/notifications/*`
(email settings, recipients, log, test send, low-stock digest, daily-report preview/send),
`/api/insights/*` (AI sales insights, forecast, feedback, location), `/api/analytics?days=N` (KPIs, revenue trend, category distribution, low stock) and
`/api/reports` (inventory health, supplier summary, sales breakdown). `clean_decimal()` recursively converts
`Decimal` to `float` before every JSON response — use it on any new response containing money.

## Seeded accounts

All seeded users share the password `password123`: `admin@breakandbrews.com` and `marcus@breakandbrews.com`
(admin role), `staff@breakandbrews.com`, `john@breakandbrews.com`, `jane@breakandbrews.com` (staff role).
`robert@breakandbrews.com` is seeded inactive and is rejected by `/api/login` with a 403.
