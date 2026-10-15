import { useState, useEffect, useCallback } from 'react';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { OrderQueue } from './components/OrderQueue';
import { WalkInMenu } from './components/WalkInMenu';
import { InventoryAlerts } from './components/InventoryAlerts';
import { StockAndExpiry } from './components/StockAndExpiry';
import { Login } from './components/Login';
import type { Ingredient, Order, IngredientRequest, StockBatch, StockInLog, StockInPayload } from './types';
import { hydrateAndMergeMenuItems } from './lib/menuStorage';
import { STORAGE_KEYS, readStore, writeStore } from './lib/storage';
import { formatQty, urgentBatchCount } from './lib/expiry';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

function App() {
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string } | null>(() => {
    const saved = localStorage.getItem('bb_staff_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [ingredients, setIngredients] = useState<Ingredient[]>(() =>
    readStore<Ingredient[]>(STORAGE_KEYS.ingredients, [])
  );
  const [orders, setOrders] = useState<Order[]>(() =>
    readStore<Order[]>(STORAGE_KEYS.orders, [])
  );
  const [menuItems, setMenuItems] = useState<any[]>(() =>
    hydrateAndMergeMenuItems(readStore<any[]>(STORAGE_KEYS.menuItems, []))
  );
  const [, setRequests] = useState<IngredientRequest[]>(() =>
    readStore<IngredientRequest[]>(STORAGE_KEYS.requests, [])
  );
  const [batches, setBatches] = useState<StockBatch[]>(() =>
    readStore<StockBatch[]>(STORAGE_KEYS.batches, [])
  );
  const [stockInLogs, setStockInLogs] = useState<StockInLog[]>(() =>
    readStore<StockInLog[]>('bb_stockin_logs', [])
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (user: { name: string; email: string; role: string }) => {
    localStorage.setItem('bb_staff_user', JSON.stringify(user));
    setCurrentUser(user);
    showToast(`Welcome back, ${user.name}!`);
  };

  const handleLogout = () => {
    localStorage.removeItem('bb_staff_user');
    setCurrentUser(null);
    showToast('Logged out successfully');
  };

  // Sync data from backend
  const syncStaffPortalData = useCallback(async (showSilentError = false) => {
    try {
      const [ingRes, ordersRes, menuRes, reqsRes, batchRes, stockInRes] = await Promise.all([
        fetch(`${API_URL}/ingredients`),
        fetch(`${API_URL}/orders`),
        fetch(`${API_URL}/menu`),
        fetch(`${API_URL}/requests`),
        fetch(`${API_URL}/batches`),
        fetch(`${API_URL}/stockin`)
      ]);

      if (ingRes.ok) {
        const data = await ingRes.json();
        setIngredients(data);
        writeStore(STORAGE_KEYS.ingredients, data);
      }
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data);
        writeStore(STORAGE_KEYS.orders, data);
      }
      if (menuRes.ok) {
        const data = await menuRes.json();
        const merged = hydrateAndMergeMenuItems(data);
        setMenuItems(merged);
        writeStore(STORAGE_KEYS.menuItems, data);
      } else {
        setMenuItems(hydrateAndMergeMenuItems([]));
      }
      if (reqsRes.ok) {
        const data = await reqsRes.json();
        setRequests(data);
        writeStore(STORAGE_KEYS.requests, data);
      }
      if (batchRes.ok) {
        const data = await batchRes.json();
        setBatches(data);
        writeStore(STORAGE_KEYS.batches, data);
      }
      if (stockInRes.ok) {
        const data = await stockInRes.json();
        setStockInLogs(data);
        writeStore('bb_stockin_logs', data);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to sync staff portal data:', err);
      setMenuItems(hydrateAndMergeMenuItems([]));
      if (!showSilentError) {
        showToast('Error syncing with database', 'error');
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    syncStaffPortalData();
  }, [syncStaffPortalData]);

  // Polling for real-time order updates (every 5 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      syncStaffPortalData(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [syncStaffPortalData]);

  // Update order status (Preparing, Complete, or Cancel)
  const handleUpdateOrderStatus = async (id: number, status: 'preparing' | 'completed' | 'cancelled') => {
    try {
      const res = await fetch(`${API_URL}/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        showToast(`Order #${id} marked as ${status}`);
        syncStaffPortalData(true);
      } else {
        const err = await res.json();
        showToast(err.error || `Failed to update order #${id}`, 'error');
      }
    } catch (err) {
      showToast('Network error updating order status', 'error');
    }
  };

  // Record a POS Sale
  const handleRecordSale = async (
    menuItemId: number,
    quantity: number,
    serveImmediately: boolean,
    size: string | null,
    customizations: { ingredient_id: number; name: string; level: string }[]
  ) => {
    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            menu_item_id: menuItemId,
            quantity,
            size,
            customizations
          }],
          status: serveImmediately ? 'completed' : 'pending',
          payment_method: 'cash'
        })
      });

      if (res.ok) {
        showToast(`Sale recorded successfully!`);
        syncStaffPortalData(true);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to record sale', 'error');
      }
    } catch (err) {
      showToast('Network error recording sale', 'error');
    }
  };

  // Request an Ingredient from Inventory
  const handleRequestIngredient = async (ingredientId: number, quantity: number, notes: string) => {
    try {
      const res = await fetch(`${API_URL}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: ingredientId,
          quantity,
          staff_name: currentUser?.name || 'Staff Member',
          notes
        })
      });

      if (res.ok) {
        showToast('Supply request sent to manager');
        syncStaffPortalData(true);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to send request', 'error');
      }
    } catch (err) {
      showToast('Network error sending request', 'error');
    }
  };

  // Receive a delivery, batch by batch, each with its own ID and expiry date
  const handleRecordStockIn = async (data: StockInPayload): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/stockin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const log: StockInLog = await res.json();
        const codes = (log.batches || []).map((b) => b.batch_code).join(', ');
        showToast(`Received ${formatQty(log.quantity)} ${log.ingredient_unit} of ${log.ingredient_name}${codes ? ` · ${codes}` : ''}`);
        syncStaffPortalData(true);
        return true;
      }
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to record delivery', 'error');
    } catch (err) {
      showToast('Network error recording delivery', 'error');
    }
    return false;
  };

  const handleUpdateBatch = async (id: number, data: { batch_code?: string; expiry_date?: string }): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/batches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        showToast('Batch updated');
        syncStaffPortalData(true);
        return true;
      }
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to update batch', 'error');
    } catch (err) {
      showToast('Network error updating batch', 'error');
    }
    return false;
  };

  const handleDiscardBatch = async (id: number, data: { quantity: number; reason: string; by: string | null }): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/batches/${id}/discard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const batch: StockBatch = await res.json();
        showToast(`Discarded ${formatQty(data.quantity)} ${batch.ingredient_unit} of ${batch.ingredient_name}`);
        syncStaffPortalData(true);
        return true;
      }
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Failed to discard batch', 'error');
    } catch (err) {
      showToast('Network error discarding batch', 'error');
    }
    return false;
  };

  const handleCreateIngredient = async (newIngData: any): Promise<Ingredient | null> => {
    try {
      const res = await fetch(`${API_URL}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIngData)
      });
      if (res.ok) {
        const saved: Ingredient = await res.json();
        showToast(`Ingredient ${saved.name} added successfully`);
        syncStaffPortalData(true);
        return saved;
      }
      const err = await res.json();
      showToast(err.error || 'Failed to add ingredient', 'error');
    } catch {
      showToast('Network error adding ingredient', 'error');
    }
    return null;
  };

  const pendingOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
  const lowStockCount = ingredients.filter(i => i.stock_level <= i.reorder_point).length;
  const expiringBatchCount = urgentBatchCount(batches);

  if (!currentUser) {
    return (
      <>
        <Login onLogin={handleLogin} />
        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`}>
            <span>{toast.message}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        pendingOrdersCount={pendingOrdersCount}
        lowStockCount={lowStockCount}
        expiringBatchCount={expiringBatchCount}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            ingredients={ingredients}
            orders={orders}
            loading={loading}
            onRefresh={() => {
              setLoading(true);
              syncStaffPortalData();
            }}
            onNavigateTab={(tab: string) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'orders' && (
          <OrderQueue
            orders={orders}
            ingredients={ingredients}
            menuItems={menuItems}
            onUpdateStatus={handleUpdateOrderStatus}
            onRecordSale={handleRecordSale}
            onRequestIngredient={handleRequestIngredient}
            loading={loading}
            onRefresh={() => {
              setLoading(true);
              syncStaffPortalData();
            }}
          />
        )}

        {activeTab === 'menu' && (
          <WalkInMenu
            menuItems={menuItems}
            ingredients={ingredients}
            onRecordSale={handleRecordSale}
            onRequestIngredient={handleRequestIngredient}
            loading={loading}
            onRefresh={() => {
              setLoading(true);
              syncStaffPortalData();
            }}
          />
        )}

        {activeTab === 'stock' && (
          <StockAndExpiry
            ingredients={ingredients}
            batches={batches}
            stockInLogs={stockInLogs}
            currentUserName={currentUser?.name ?? null}
            loading={loading}
            onRefresh={() => {
              setLoading(true);
              syncStaffPortalData();
            }}
            onRecordStockIn={handleRecordStockIn}
            onUpdateBatch={handleUpdateBatch}
            onDiscardBatch={handleDiscardBatch}
            onCreateIngredient={handleCreateIngredient}
          />
        )}

        {activeTab === 'alerts' && (
          <InventoryAlerts
            ingredients={ingredients}
            loading={loading}
            onRequestIngredient={handleRequestIngredient}
            onRefresh={() => {
              setLoading(true);
              syncStaffPortalData();
            }}
          />
        )}
      </main>

      {/* Floating global Toast notifications */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`}>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
