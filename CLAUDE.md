# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Break & Brews is a café/billiards management system: one Flask + PostgreSQL API (`backend/`) serving three
independent Vite + React 19 + TypeScript SPAs — `admin/` (inventory, menu/recipes, requests, stock-in, reports),
`staffs/` (kitchen order queue, ingredient requests), and `customer/` (mobile-first ordering + live order tracker).

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

Other stock movements: `POST /api/stockin` adds quantity and recomputes `cost_per_unit` from `cost / quantity`;
approving an `IngredientRequest` (`PUT /api/requests/<id>`) deducts the requested quantity and un-approving adds it
back — approval transitions, not creation, are what move stock.

### Cross-portal "real time" is polling, not sockets

All three portals `setInterval` against the same REST API and re-fetch everything: admin and staffs every 5s,
customer's order tracker every 3s. The order lifecycle spans portals — customer POSTs an order with
`status: 'pending'` → staff sees it in `OrderQueue` and PUTs `preparing`/`completed`/`cancelled` → customer's
tracker picks the change up on its next poll. Stock deductions ripple into the admin dashboard the same way.
Valid order statuses are enforced server-side: `pending`, `preparing`, `completed`, `cancelled`.

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
  cream/espresso tokens in its own `index.css`, with breakpoints at 900/780/520px and a mobile tab bar; keep new
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
- **No portal hardcodes catalog data.** Menu items, prices, product imagery (`menu_items.image_url`), recipes,
  menu categories, ingredient categories and units all come from the API. Admin's category and unit fields are
  free text backed by a `<datalist>` of the values already in the database, so a new category needs no code
  change and shows up in the customer portal's rail on its next poll.

### API surface (`backend/app.py`, ~600 lines, all routes in one file)

`/api/ingredients`, `/api/menu`, `/api/requests`, `/api/stockin`, `/api/staff`, `/api/orders` (CRUD subsets),
plus `/api/login`, `/api/analytics?days=N` (KPIs, revenue trend, category distribution, low stock) and
`/api/reports` (inventory health, supplier summary, sales breakdown). `clean_decimal()` recursively converts
`Decimal` to `float` before every JSON response — use it on any new response containing money.

## Seeded accounts

All seeded users share the password `password123`: `admin@breakandbrews.com` and `marcus@breakandbrews.com`
(admin role), `staff@breakandbrews.com`, `john@breakandbrews.com`, `jane@breakandbrews.com` (staff role).
`robert@breakandbrews.com` is seeded inactive and is rejected by `/api/login` with a 403.
