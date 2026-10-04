import { useState, useEffect, useCallback } from 'react';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Dashboard } from './components/Dashboard';
import { IngredientsList } from './components/IngredientsList';
import { ManageMenu } from './components/ManageMenu';
import { ManageRequests } from './components/ManageRequests';
import { RecordStockIn } from './components/RecordStockIn';
import { Reports } from './components/Reports';
import { ManageReviews } from './components/ManageReviews';
import { TableQrCodes } from './components/TableQrCodes';
import { EmailNotifications } from './components/EmailNotifications';
import { Login } from './components/Login';
import type { Ingredient, MenuItem, IngredientRequest, StockInLog, AnalyticsData, ReportData, Review, Subscriber, Order, AnnouncementResult } from './types';
import { hydrateAndMergeMenuItems, saveCustomMenuItem, removeCustomMenuItem, getCustomMenuItems, getDeletedMenuItemIds } from './lib/menuStorage';
import { STORAGE_KEYS, readStore, writeStore } from './lib/storage';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

function App() {
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string } | null>(() => {
    const saved = localStorage.getItem('bb_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('bb_admin_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
    } else {
      root.classList.remove('light-theme');
    }
    localStorage.setItem('bb_admin_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const handleLogout = () => {
    localStorage.removeItem('bb_admin_user');
    setCurrentUser(null);
    showToast('Logged out successfully');
  };

  const handleLogin = (user: { name: string; email: string; role: string }) => {
    localStorage.setItem('bb_admin_user', JSON.stringify(user));
    setCurrentUser(user);
    showToast(`Welcome back, ${user.name}!`);
  };
  
  // Data States with Persistent Storage Fallbacks
  const [ingredients, setIngredients] = useState<Ingredient[]>(() =>
    readStore<Ingredient[]>(STORAGE_KEYS.ingredients, [])
  );
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() =>
    hydrateAndMergeMenuItems(readStore<MenuItem[]>(STORAGE_KEYS.menuItems, []))
  );
  const [requests, setRequests] = useState<IngredientRequest[]>(() =>
    readStore<IngredientRequest[]>(STORAGE_KEYS.requests, [])
  );
  const [orders, setOrders] = useState<Order[]>(() =>
    readStore<Order[]>(STORAGE_KEYS.orders, [])
  );
  const [stockInLogs, setStockInLogs] = useState<StockInLog[]>(() =>
    readStore<StockInLog[]>(STORAGE_KEYS.stockIn, [])
  );
  const [reviews, setReviews] = useState<Review[]>(() =>
    readStore<Review[]>(STORAGE_KEYS.reviews, [])
  );
  const [subscribers, setSubscribers] = useState<Subscriber[]>(() =>
    readStore<Subscriber[]>(STORAGE_KEYS.subscribers, [])
  );
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(() =>
    readStore<AnalyticsData | null>(STORAGE_KEYS.analytics, null)
  );
  const [analyticsDays, setAnalyticsDays] = useState<number>(7);

  // Global UX States
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    // Longer messages (e.g. why an email was not sent) stay up long enough to read.
    setTimeout(() => setToast(null), Math.min(8000, Math.max(3000, message.length * 60)));
  };

  // Sync all core database lists
  const syncInventoryData = async (silent = false) => {
    try {
      const [ingRes, menuRes, reqRes, orderRes, stockRes, reviewRes, subRes, analyticsRes] = await Promise.all([
        fetch(`${API_URL}/ingredients`),
        fetch(`${API_URL}/menu`),
        fetch(`${API_URL}/requests`),
        fetch(`${API_URL}/orders`),
        fetch(`${API_URL}/stockin`),
        fetch(`${API_URL}/reviews?all=1`),
        fetch(`${API_URL}/subscribers`),
        fetch(`${API_URL}/analytics?days=${analyticsDays}`)
      ]);

      if (ingRes.ok) {
        const data = await ingRes.json();
        setIngredients(data);
        writeStore(STORAGE_KEYS.ingredients, data);
      }
      if (menuRes.ok) {
        const fetchedMenu: MenuItem[] = await menuRes.json();
        const merged = hydrateAndMergeMenuItems(fetchedMenu);
        setMenuItems(merged);
        writeStore(STORAGE_KEYS.menuItems, fetchedMenu);

        // Sync local menu items (like "tolits cafe") to backend DB if missing from server
        const customItems = getCustomMenuItems();
        const deletedIds = getDeletedMenuItemIds();
        const fetchedNames = new Set(fetchedMenu.map((i) => i.name.toLowerCase().trim()));

        for (const item of customItems) {
          if (!deletedIds.includes(item.id) && !fetchedNames.has(item.name.toLowerCase().trim())) {
            try {
              const res = await fetch(`${API_URL}/menu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
              });
              if (res.ok) {
                const saved = await res.json();
                saveCustomMenuItem(saved);
              }
            } catch (err) {
              console.warn('Failed to sync local menu item to backend:', item.name, err);
            }
          }
        }
      } else {
        setMenuItems(hydrateAndMergeMenuItems([]));
      }
      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequests(data);
        writeStore(STORAGE_KEYS.requests, data);
      }
      if (orderRes.ok) {
        const data = await orderRes.json();
        setOrders(data);
        writeStore(STORAGE_KEYS.orders, data);
      }
      if (stockRes.ok) {
        const data = await stockRes.json();
        setStockInLogs(data);
        writeStore(STORAGE_KEYS.stockIn, data);
      }
      if (reviewRes.ok) {
        const data = await reviewRes.json();
        setReviews(data);
        writeStore(STORAGE_KEYS.reviews, data);
      }
      if (subRes.ok) {
        const data = await subRes.json();
        setSubscribers(data);
        writeStore(STORAGE_KEYS.subscribers, data);
      }
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalyticsData(data);
        writeStore(STORAGE_KEYS.analytics, data);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to sync system parameters:', err);
      if (!silent) {
        showToast('Error syncing system parameters', 'error');
      }
    }
  };

  // Fetch initial datasets once
  useEffect(() => {
    syncInventoryData();
  }, []);

  // Fetch analytics when timeframe changes
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${API_URL}/analytics?days=${analyticsDays}`);
        if (res.ok) setAnalyticsData(await res.json());
      } catch (err) {
        console.error('Failed to fetch analytics for timeframe:', err);
      }
    };
    fetchAnalytics();
  }, [analyticsDays]);

  // Periodic polling for real-time dashboard alerts and request lists every 5 seconds
  useEffect(() => {
    const pollTimer = setInterval(async () => {
      syncInventoryData(true);
    }, 5000);
    return () => clearInterval(pollTimer);
  }, [analyticsDays]);

  // ------------ INGREDIENTS HANDLERS ------------
  const handleCreateIngredient = async (data: any) => {
    try {
      const res = await fetch(`${API_URL}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        showToast('Ingredient added successfully');
        syncInventoryData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to add ingredient', 'error');
      }
    } catch (err) {
      showToast('Network error adding ingredient', 'error');
    }
  };

  const handleUpdateIngredient = async (id: number, data: any) => {
    try {
      const res = await fetch(`${API_URL}/ingredients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        showToast('Ingredient updated successfully');
        syncInventoryData();
      } else {
        showToast('Failed to update ingredient', 'error');
      }
    } catch (err) {
      showToast('Network error updating ingredient', 'error');
    }
  };

  const handleDeleteIngredient = async (id: number) => {
    if (!confirm('Are you sure you want to delete this ingredient?')) return;
    try {
      const res = await fetch(`${API_URL}/ingredients/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Ingredient deleted');
        syncInventoryData();
      } else {
        showToast('Failed to delete ingredient', 'error');
      }
    } catch (err) {
      showToast('Network error deleting ingredient', 'error');
    }
  };

  // ------------ MENU CATALOG HANDLERS ------------
  const handleCreateMenuItem = async (data: any) => {
    try {
      const res = await fetch(`${API_URL}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const { announcement, ...createdItem }: MenuItem & { announcement?: AnnouncementResult } = await res.json();
        saveCustomMenuItem(createdItem);
        if (announcement?.status === 'skipped') {
          showToast(`Added "${createdItem.name}", but subscribers were not emailed: ${announcement.error}`, 'error');
        } else if (announcement) {
          showToast(`Added "${createdItem.name}" and emailing ${announcement.recipient_count} subscriber(s)`);
        } else {
          showToast('Menu item added successfully');
        }
        await syncInventoryData(true);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to add menu item', 'error');
      }
    } catch (err) {
      // Offline fallback
      const createdItem: MenuItem = {
        id: Date.now(),
        name: data.name,
        category: data.category,
        price: Number(data.price || 0),
        price_small: data.price_small != null ? Number(data.price_small) : null,
        price_medium: data.price_medium != null ? Number(data.price_medium) : null,
        price_large: data.price_large != null ? Number(data.price_large) : null,
        is_available: data.is_available ?? true,
        image_url: data.image_url || null,
        offered_sizes: data.offered_sizes || [],
        ingredients: data.ingredients || [],
        created_at: new Date().toISOString()
      };
      saveCustomMenuItem(createdItem);
      showToast('Added menu item locally', 'success');
      await syncInventoryData(true);
    }
  };

  const handleUpdateMenuItem = async (id: number, data: any) => {
    try {
      const res = await fetch(`${API_URL}/menu/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const updatedItem: MenuItem = await res.json();
        saveCustomMenuItem(updatedItem);
        showToast('Menu item updated successfully');
        await syncInventoryData(true);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update menu item', 'error');
      }
    } catch (err) {
      const existing = menuItems.find((m) => m.id === id);
      const updatedItem: MenuItem = {
        ...(existing || { id, name: data.name || '', category: data.category || '', created_at: new Date().toISOString() }),
        ...data,
        price: data.price != null ? Number(data.price) : existing?.price || 0
      };
      saveCustomMenuItem(updatedItem);
      showToast('Updated menu item locally', 'success');
      await syncInventoryData(true);
    }
  };

  const handleDeleteMenuItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      const res = await fetch(`${API_URL}/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Menu item deleted');
      } else {
        showToast('Failed to delete menu item', 'error');
      }
    } catch (err) {
      showToast('Deleted menu item locally', 'success');
    }
    removeCustomMenuItem(id);
    await syncInventoryData(true);
  };

  // ------------ REQUEST HANDLERS ------------
  const handleCreateRequest = async (data: any) => {
    try {
      const res = await fetch(`${API_URL}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        showToast('Ingredient request submitted');
        syncInventoryData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to submit request', 'error');
      }
    } catch (err) {
      showToast('Network error submitting request', 'error');
    }
  };

  /* const _handleDeleteRequest = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/requests/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Request log cleared');
        syncInventoryData();
      }
    } catch (err) {
      showToast('Network error deleting request log', 'error');
    }
  }; */

  // ------------ RECORD STOCK IN HANDLER ------------
  const handleRecordStockIn = async (data: any) => {
    try {
      const res = await fetch(`${API_URL}/stockin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        showToast('Shipment logged and inventory updated');
        syncInventoryData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to record shipment', 'error');
      }
    } catch (err) {
      showToast('Network error recording shipment', 'error');
    }
  };

  // ------------ REPORTS FETCH HANDLER ------------
  const handleFetchReports = useCallback(async (): Promise<ReportData | null> => {
    try {
      const res = await fetch(`${API_URL}/reports`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    }
    return null;
  }, []);

  // Badges calculations for Sidebar nav items
  const lowStockCount = ingredients.filter(i => i.stock_level <= i.reorder_point).length;
  const pendingReviewsCount = reviews.filter(r => !r.is_published).length;

  // ------------ REVIEW HANDLERS ------------
  const handlePublishReview = async (id: number, isPublished: boolean) => {
    try {
      const res = await fetch(`${API_URL}/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: isPublished })
      });
      if (res.ok) {
        showToast(isPublished ? 'Review published to the storefront' : 'Review hidden from the storefront');
        syncInventoryData();
      } else {
        showToast('Failed to update review', 'error');
      }
    } catch {
      showToast('Network error updating review', 'error');
    }
  };

  const handleDeleteSubscriber = async (id: number) => {
    const sub = subscribers.find(s => s.id === id);
    if (!confirm(`Remove ${sub?.email ?? 'this subscriber'} from the list? They will not get new-menu emails.`)) return;
    try {
      const res = await fetch(`${API_URL}/subscribers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Subscriber removed');
        syncInventoryData();
      } else {
        showToast('Failed to remove subscriber', 'error');
      }
    } catch {
      showToast('Network error removing subscriber', 'error');
    }
  };

  const handleDeleteReview = async (id: number) => {
    if (!confirm('Delete this review permanently?')) return;
    try {
      const res = await fetch(`${API_URL}/reviews/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Review deleted');
        syncInventoryData();
      } else {
        showToast('Failed to delete review', 'error');
      }
    } catch {
      showToast('Network error deleting review', 'error');
    }
  };

  if (!currentUser) {
    return (
      <>
        <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />
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
      {/* Mobile Sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Side Navigation Bar */}
      <div className={`sidebar-container ${sidebarOpen ? 'open' : ''}`}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setSidebarOpen(false);
          }} 
          lowStockCount={lowStockCount}
          pendingReviewsCount={pendingReviewsCount}
        />
      </div>

      {/* Main Workspace Frame */}
      <div className="main-content">
        <Topbar 
          activeTab={activeTab} 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          currentUser={currentUser}
          onLogout={handleLogout}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        
        {activeTab === 'dashboard' && (
          <Dashboard 
            analyticsData={analyticsData} 
            loading={loading}
            analyticsDays={analyticsDays}
            setAnalyticsDays={setAnalyticsDays}
            ingredients={ingredients}
            onCreateRequest={handleCreateRequest}
          />
        )}
        
        {activeTab === 'ingredients' && (
          <IngredientsList
            ingredients={ingredients}
            onCreateIngredient={handleCreateIngredient}
            onUpdateIngredient={handleUpdateIngredient}
            onDeleteIngredient={handleDeleteIngredient}
          />
        )}

        {activeTab === 'tables' && <TableQrCodes />}

        {activeTab === 'menu' && (
          <ManageMenu 
            menuItems={menuItems} 
            ingredients={ingredients}
            onCreateMenuItem={handleCreateMenuItem}
            onUpdateMenuItem={handleUpdateMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
          />
        )}

        {activeTab === 'requests' && (
          <ManageRequests
            orders={orders}
            menuItems={menuItems}
            ingredients={ingredients}
          />
        )}

        {activeTab === 'stockin' && (
          <RecordStockIn 
            stockInLogs={stockInLogs}
            ingredients={ingredients}
            requests={requests}
            onRecordStockIn={handleRecordStockIn}
          />
        )}

        {activeTab === 'reviews' && (
          <ManageReviews
            reviews={reviews}
            subscribers={subscribers}
            onPublishReview={handlePublishReview}
            onDeleteReview={handleDeleteReview}
            onDeleteSubscriber={handleDeleteSubscriber}
          />
        )}

        {activeTab === 'notifications' && <EmailNotifications showToast={showToast} />}

        {activeTab === 'reports' && (
          <Reports 
            onFetchReports={handleFetchReports}
          />
        )}
      </div>

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
