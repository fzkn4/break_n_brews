import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header, { TabBar } from './components/Header';
import HomeView from './components/HomeView';
import MenuView from './components/MenuView';
import TrackerView from './components/TrackerView';
import CartDrawer from './components/CartDrawer';
import type { CheckoutDetails } from './components/CartDrawer';
import ProductSheet from './components/ProductSheet';
import Footer from './components/Footer';
import Toaster from './components/Toaster';
import type { ToastMessage } from './components/Toaster';
import type { ReviewDraft } from './components/ReviewForm';
import {
  API_URL,
  availabilityOf,
  cartCount,
  cartLineId,
  reservedByCart,
  stockMapFrom
} from './lib/catalog';
import { readStore, writeStore, clearStore, STORAGE_KEYS } from './lib/storage';
import type {
  CartItem,
  CustomizationLevel,
  Ingredient,
  MenuItem,
  Order,
  OrderMeta,
  Review,
  View
} from './types';
import { ShoppingBag } from 'lucide-react';
import './index.css';

const MENU_POLL_MS = 10000;
const ORDER_POLL_MS = 3000;
const HISTORY_LIMIT = 6;

const DEFAULT_DETAILS: CheckoutDetails = {
  name: '',
  dining: 'dine_in',
  table: '',
  payment: 'cash'
};

function App() {
  // ----- View & overlays ---------------------------------------------------
  const [view, setView] = useState<View>('home');
  const [cartOpen, setCartOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);

  // ----- Catalog -----------------------------------------------------------
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // ----- Browsing ----------------------------------------------------------
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<number[]>(() => readStore<number[]>(STORAGE_KEYS.favorites, []));

  // ----- Cart & checkout ---------------------------------------------------
  const [cart, setCart] = useState<CartItem[]>(() => readStore<CartItem[]>(STORAGE_KEYS.cart, []));
  const [details, setDetails] = useState<CheckoutDetails>(() =>
    readStore<CheckoutDetails>(STORAGE_KEYS.checkout, DEFAULT_DETAILS)
  );
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // ----- Orders ------------------------------------------------------------
  const [activeOrderId, setActiveOrderId] = useState<number | null>(() =>
    readStore<number | null>(STORAGE_KEYS.activeOrder, null)
  );
  const [historyIds, setHistoryIds] = useState<number[]>(() =>
    readStore<number[]>(STORAGE_KEYS.orderHistory, [])
  );
  const [orders, setOrders] = useState<Record<number, Order>>({});
  const [orderMeta, setOrderMeta] = useState<Record<number, OrderMeta>>(() =>
    readStore<Record<number, OrderMeta>>(STORAGE_KEYS.orderMeta, {})
  );

  // ----- Reviews -----------------------------------------------------------
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewedOrders, setReviewedOrders] = useState<number[]>(() =>
    readStore<number[]>(STORAGE_KEYS.reviewedOrders, [])
  );
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // ----- Toasts ------------------------------------------------------------
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3200);
  }, []);

  // ----- Persistence -------------------------------------------------------
  useEffect(() => writeStore(STORAGE_KEYS.cart, cart), [cart]);
  useEffect(() => writeStore(STORAGE_KEYS.favorites, favorites), [favorites]);
  useEffect(() => writeStore(STORAGE_KEYS.checkout, details), [details]);
  useEffect(() => writeStore(STORAGE_KEYS.orderHistory, historyIds), [historyIds]);
  useEffect(() => writeStore(STORAGE_KEYS.orderMeta, orderMeta), [orderMeta]);
  useEffect(() => writeStore(STORAGE_KEYS.reviewedOrders, reviewedOrders), [reviewedOrders]);

  // ----- Catalog fetching --------------------------------------------------
  const loadCatalog = useCallback(async () => {
    try {
      const [menuRes, ingredientRes] = await Promise.all([
        fetch(`${API_URL}/menu`),
        fetch(`${API_URL}/ingredients`)
      ]);
      if (menuRes.ok) {
        const data: MenuItem[] = await menuRes.json();
        setMenuItems(data.filter((item) => item.is_available));
      }
      // Stock levels drive the availability badges; without them we simply stop showing them.
      if (ingredientRes.ok) setIngredients(await ingredientRes.json());
      setOffline(!menuRes.ok);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    const timer = setInterval(loadCatalog, MENU_POLL_MS);
    return () => clearInterval(timer);
  }, [loadCatalog]);

  /** Published reviews only — the endpoint hides anything an admin has not approved. */
  const loadReviews = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/reviews?limit=6`);
      if (res.ok) setReviews(await res.json());
    } catch {
      /* the wall simply stays empty */
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // ----- Order polling -----------------------------------------------------
  const fetchOrder = useCallback(async (orderId: number): Promise<Order | null> => {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}`);
      if (res.ok) {
        const order: Order = await res.json();
        setOrders((current) => ({ ...current, [order.id]: order }));
        return order;
      }
      if (res.status === 404) {
        setOrders((current) => {
          const next = { ...current };
          delete next[orderId];
          return next;
        });
        setHistoryIds((current) => current.filter((id) => id !== orderId));
        setActiveOrderId((current) => (current === orderId ? null : current));
      }
    } catch {
      /* the poll will try again shortly */
    }
    return null;
  }, []);

  useEffect(() => {
    if (activeOrderId === null) return;
    fetchOrder(activeOrderId);
    const timer = setInterval(() => fetchOrder(activeOrderId), ORDER_POLL_MS);
    return () => clearInterval(timer);
  }, [activeOrderId, fetchOrder]);

  useEffect(() => {
    writeStore(STORAGE_KEYS.activeOrder, activeOrderId);
    if (activeOrderId === null) clearStore(STORAGE_KEYS.activeOrder);
  }, [activeOrderId]);

  // Refresh the whole history whenever the tracker is opened.
  useEffect(() => {
    if (view !== 'tracker') return;
    for (const id of historyIds.slice(0, HISTORY_LIMIT)) fetchOrder(id);
  }, [view, historyIds, fetchOrder]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view]);

  // ----- Derived -----------------------------------------------------------
  const menuById = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems]);
  const stock = useMemo(() => stockMapFrom(ingredients), [ingredients]);
  const reserved = useMemo(() => reservedByCart(cart, menuById), [cart, menuById]);

  const availabilityFor = useCallback(
    (item: MenuItem) => availabilityOf(item, stock, reserved),
    [stock, reserved]
  );

  const activeOrder = activeOrderId === null ? null : orders[activeOrderId] ?? null;
  const liveOrder = activeOrder && ['pending', 'preparing'].includes(activeOrder.status) ? activeOrder : null;

  const history = useMemo(
    () =>
      historyIds
        .slice(0, HISTORY_LIMIT)
        .map((id) => orders[id])
        .filter((order): order is Order => Boolean(order)),
    [historyIds, orders]
  );

  // Menu items pulled by the admin should not linger in the cart.
  useEffect(() => {
    if (menuItems.length === 0) return;
    setCart((current) => {
      const kept = current.filter((line) => menuById.has(line.menuItemId));
      if (kept.length === current.length) return current;
      notify('Some items are no longer available and were removed from your cart.', 'info');
      return kept;
    });
  }, [menuItems.length, menuById, notify]);

  // ----- Actions -----------------------------------------------------------
  const goTo = (next: View) => {
    setView(next);
    setCartOpen(false);
  };

  const browse = (nextCategory?: string) => {
    setCategory(nextCategory ?? 'All');
    setOnlyFavorites(false);
    goTo('menu');
  };

  const toggleFavorite = (id: number) => {
    setFavorites((current) => {
      const isFavorite = current.includes(id);
      notify(isFavorite ? 'Removed from favourites' : 'Saved to favourites', 'info');
      return isFavorite ? current.filter((favorite) => favorite !== id) : [...current, id];
    });
  };

  const addToCart = (item: MenuItem, levels: Record<number, CustomizationLevel>, quantity: number) => {
    const lineId = cartLineId(item.id, levels);
    const customizations = item.ingredients
      .filter((ingredient) => ingredient.is_customizable)
      .map((ingredient) => ({
        ingredient_id: ingredient.ingredient_id,
        name: ingredient.name,
        level: levels[ingredient.ingredient_id] ?? ('Regular' as CustomizationLevel)
      }));

    setCart((current) => {
      const existing = current.find((line) => line.id === lineId);
      if (existing) {
        return current.map((line) =>
          line.id === lineId ? { ...line, quantity: line.quantity + quantity } : line
        );
      }
      return [
        ...current,
        { id: lineId, menuItemId: item.id, name: item.name, price: item.price, quantity, customizations }
      ];
    });

    setSheetItem(null);
    notify(`${quantity} × ${item.name} added to your order`);
  };

  const changeQuantity = (lineId: string, delta: number) => {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.id !== lineId) return [line];
        const quantity = line.quantity + delta;
        return quantity <= 0 ? [] : [{ ...line, quantity }];
      })
    );
  };

  const removeLine = (lineId: string) => {
    setCart((current) => current.filter((line) => line.id !== lineId));
    notify('Item removed', 'info');
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setCheckoutError(null);

    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((line) => ({
            menu_item_id: line.menuItemId,
            quantity: line.quantity,
            customizations: line.customizations
          })),
          status: 'pending',
          payment_method: details.payment
        })
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        // The backend rejects customer orders it cannot make; show its reason verbatim.
        setCheckoutError(body?.error ?? 'Something went wrong at the counter. Please try again.');
        loadCatalog();
        return;
      }

      const order = body as Order;
      setOrders((current) => ({ ...current, [order.id]: order }));
      setOrderMeta((current) => ({
        ...current,
        [order.id]: {
          orderId: order.id,
          name: details.name.trim(),
          dining: details.dining,
          table: details.table.trim(),
          payment: details.payment,
          placedAt: order.created_at
        }
      }));
      setHistoryIds((current) => [order.id, ...current.filter((id) => id !== order.id)].slice(0, HISTORY_LIMIT));
      setActiveOrderId(order.id);
      setCart([]);
      setCartOpen(false);
      setView('tracker');
      notify(`Order #${order.id} is with the barista`);
      loadCatalog();
    } catch {
      setCheckoutError('We could not reach the counter. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reorder = (order: Order) => {
    const lines: CartItem[] = [];
    let skipped = 0;

    for (const orderItem of order.items) {
      const item = menuById.get(orderItem.menu_item_id);
      if (!item) {
        skipped += 1;
        continue;
      }
      const levels: Record<number, CustomizationLevel> = {};
      for (const custom of orderItem.customizations) levels[custom.ingredient_id] = custom.level;
      lines.push({
        id: cartLineId(item.id, levels),
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: orderItem.quantity,
        customizations: orderItem.customizations
      });
    }

    if (lines.length === 0) {
      notify('None of those items are on the menu right now.', 'error');
      return;
    }

    setCart(lines);
    setCartOpen(true);
    notify(skipped > 0 ? `${skipped} item(s) are no longer available and were skipped.` : 'Order rebuilt in your cart');
  };

  const subscribe = async (email: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) return true;
      const body = await res.json().catch(() => null);
      notify(body?.error ?? 'That did not go through. Try again in a moment.', 'error');
    } catch {
      notify('We could not reach the counter. Check your connection.', 'error');
    }
    return false;
  };

  const submitReview = async (order: Order, draft: ReviewDraft) => {
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const res = await fetch(`${API_URL}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, order_id: order.id })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setReviewError(body?.error ?? 'We could not send that review. Try again.');
        return;
      }
      setReviewedOrders((current) => [...new Set([...current, order.id])]);
      notify('Thanks! Your review is with the team.');
      loadReviews();
    } catch {
      setReviewError('We could not reach the counter. Check your connection and try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const startNewOrder = () => {
    setActiveOrderId(null);
    browse();
  };

  const count = cartCount(cart);

  return (
    <div className="app-shell">
      <Header
        view={view}
        onNavigate={goTo}
        cartCount={count}
        onOpenCart={() => setCartOpen(true)}
        hasLiveOrder={Boolean(liveOrder)}
      />

      <main className="app-main">
        {offline && !loading && (
          <div className="shell" style={{ paddingTop: 18 }}>
            <div className="callout callout--warning">
              <ShoppingBag size={20} />
              <div>
                <div className="callout__title">We cannot reach the kitchen right now</div>
                <div className="callout__text">
                  The menu below may be out of date. It will refresh by itself once the connection is back.
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'home' && (
          <HomeView
            menuItems={menuItems}
            loading={loading}
            favorites={favorites}
            liveOrder={liveOrder}
            reviews={reviews}
            availabilityFor={availabilityFor}
            onOpen={setSheetItem}
            onToggleFavorite={toggleFavorite}
            onBrowse={browse}
            onTrack={() => goTo('tracker')}
            onSubscribe={subscribe}
          />
        )}

        {view === 'menu' && (
          <MenuView
            menuItems={menuItems}
            loading={loading}
            category={category}
            search={search}
            favorites={favorites}
            onlyFavorites={onlyFavorites}
            availabilityFor={availabilityFor}
            onCategoryChange={setCategory}
            onSearchChange={setSearch}
            onToggleOnlyFavorites={() => setOnlyFavorites((current) => !current)}
            onOpen={setSheetItem}
            onToggleFavorite={toggleFavorite}
          />
        )}

        {view === 'tracker' && (
          <TrackerView
            order={activeOrder ?? history[0] ?? null}
            meta={activeOrder ? orderMeta[activeOrder.id] ?? null : null}
            history={history}
            onSelect={setActiveOrderId}
            onBrowse={() => browse()}
            onReorder={reorder}
            onStartNew={startNewOrder}
            reviewed={activeOrder ? reviewedOrders.includes(activeOrder.id) : false}
            reviewSubmitting={reviewSubmitting}
            reviewError={reviewError}
            onSubmitReview={submitReview}
          />
        )}
      </main>

      <Footer onNavigate={goTo} />

      <TabBar
        view={view}
        onNavigate={goTo}
        cartCount={count}
        onOpenCart={() => setCartOpen(true)}
        hasLiveOrder={Boolean(liveOrder)}
      />

      {count > 0 && !cartOpen && (
        <button className="floating-cart" onClick={() => setCartOpen(true)}>
          <ShoppingBag size={20} />
          {count} item{count === 1 ? '' : 's'} · View order
        </button>
      )}

      {sheetItem && (
        <ProductSheet
          item={sheetItem}
          stock={stock}
          reserved={reserved}
          onClose={() => setSheetItem(null)}
          onAdd={addToCart}
        />
      )}

      {cartOpen && (
        <CartDrawer
          cart={cart}
          menuById={menuById}
          stock={stock}
          reserved={reserved}
          details={details}
          submitting={submitting}
          error={checkoutError}
          onDetailsChange={setDetails}
          onClose={() => setCartOpen(false)}
          onQuantityChange={changeQuantity}
          onRemove={removeLine}
          onBrowse={() => browse()}
          onSubmit={placeOrder}
        />
      )}

      <Toaster toasts={toasts} />
    </div>
  );
}

export default App;
