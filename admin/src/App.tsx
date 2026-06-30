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
import { Login } from './components/Login';
import type { Ingredient, MenuItem, IngredientRequest, StockInLog, AnalyticsData, ReportData } from './types';

const API_URL = 'http://localhost:5000/api';

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
  
  // Data States
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [requests, setRequests] = useState<IngredientRequest[]>([]);
  const [stockInLogs, setStockInLogs] = useState<StockInLog[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState<number>(7);

  // Global UX States
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Sync all core database lists
  const syncInventoryData = async (silent = false) => {
    try {
      const [ingRes, menuRes, reqRes, stockRes, analyticsRes] = await Promise.all([
        fetch(`${API_URL}/ingredients`),
        fetch(`${API_URL}/menu`),
        fetch(`${API_URL}/requests`),
        fetch(`${API_URL}/stockin`),
        fetch(`${API_URL}/analytics?days=${analyticsDays}`)
      ]);

      if (ingRes.ok) setIngredients(await ingRes.json());
      if (menuRes.ok) setMenuItems(await menuRes.json());
      if (reqRes.ok) setRequests(await reqRes.json());
      if (stockRes.ok) setStockInLogs(await stockRes.json());
      if (analyticsRes.ok) setAnalyticsData(await analyticsRes.json());
      
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
        showToast('Menu item added successfully');
        syncInventoryData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to add menu item', 'error');
      }
    } catch (err) {
      showToast('Network error adding menu item', 'error');
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
        showToast('Menu item updated successfully');
        syncInventoryData();
      } else {
        showToast('Failed to update menu item', 'error');
      }
    } catch (err) {
      showToast('Network error updating menu item', 'error');
    }
  };

  const handleDeleteMenuItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      const res = await fetch(`${API_URL}/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Menu item deleted');
        syncInventoryData();
      } else {
        showToast('Failed to delete menu item', 'error');
      }
    } catch (err) {
      showToast('Network error deleting menu item', 'error');
    }
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

  const handleApproveRequest = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      if (res.ok) {
        showToast('Request approved and inventory decremented');
        syncInventoryData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Approval failed', 'error');
      }
    } catch (err) {
      showToast('Network error approving request', 'error');
    }
  };

  const handleRejectRequest = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      if (res.ok) {
        showToast('Request rejected successfully');
        syncInventoryData();
      } else {
        showToast('Failed to reject request', 'error');
      }
    } catch (err) {
      showToast('Network error rejecting request', 'error');
    }
  };

  const handleDeleteRequest = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/requests/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Request log cleared');
        syncInventoryData();
      }
    } catch (err) {
      showToast('Network error deleting request log', 'error');
    }
  };

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
  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

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
          pendingRequestsCount={pendingRequestsCount}
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
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
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

        {activeTab === 'menu' && (
          <ManageMenu 
            menuItems={menuItems} 
            onCreateMenuItem={handleCreateMenuItem}
            onUpdateMenuItem={handleUpdateMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
          />
        )}

        {activeTab === 'requests' && (
          <ManageRequests 
            requests={requests}
            ingredients={ingredients}
            onCreateRequest={handleCreateRequest}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
            onDeleteRequest={handleDeleteRequest}
          />
        )}

        {activeTab === 'stockin' && (
          <RecordStockIn 
            stockInLogs={stockInLogs}
            ingredients={ingredients}
            onRecordStockIn={handleRecordStockIn}
          />
        )}

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
