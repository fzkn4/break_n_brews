import { useState, useEffect, useCallback } from 'react';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { OrderQueue } from './components/OrderQueue';
import { Login } from './components/Login';
import type { Ingredient, Order } from './types';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string } | null>(() => {
    const saved = localStorage.getItem('bb_staff_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('bb_staff_theme');
    return (saved as 'dark' | 'light') || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
    }
    localStorage.setItem('bb_staff_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

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
      const [ingRes, ordersRes, menuRes] = await Promise.all([
        fetch(`${API_URL}/ingredients`),
        fetch(`${API_URL}/orders`),
        fetch(`${API_URL}/menu_items`)
      ]);

      if (ingRes.ok) setIngredients(await ingRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (menuRes.ok) setMenuItems(await menuRes.json());
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to sync staff portal data:', err);
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
  const handleRecordSale = async (menuItemId: number, quantity: number, serveImmediately: boolean) => {
    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ menu_item_id: menuItemId, quantity }],
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
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to send request', 'error');
      }
    } catch (err) {
      showToast('Network error sending request', 'error');
    }
  };

  const pendingOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;

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
        theme={theme}
        toggleTheme={toggleTheme}
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
