import React from 'react';
import { LayoutDashboard, Package, UtensilsCrossed, AlertTriangle, LogOut, CalendarClock } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  pendingOrdersCount: number;
  pendingRequestsCount?: number;
  lowStockCount?: number;
  /** Batches expired or expiring within 2 days. */
  expiringBatchCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  pendingOrdersCount,
  lowStockCount = 0,
  expiringBatchCount = 0,
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'orders', label: 'ORDER QUEUE', icon: Package, badge: pendingOrdersCount },
    { id: 'menu', label: 'MENU', icon: UtensilsCrossed },
    { id: 'stock', label: 'STOCK IN & EXPIRY', icon: CalendarClock, badge: expiringBatchCount, badgeColor: '#f97316' },
    { id: 'alerts', label: 'INVENTORY ALERT', icon: AlertTriangle, badge: lowStockCount, badgeColor: '#FF4D4D' },
  ];

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brandSection}>
        <div style={styles.logoContainer}>
          <img
            src="/break_and_brews.png"
            alt="Break & Brews Logo"
            style={styles.logoImage}
          />
        </div>
        <h1 style={styles.brandTitle}>STAFF</h1>
      </div>

      <nav style={styles.nav}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`group flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ease-in-out hover:translate-x-1 sidebar-nav-btn ${isActive ? 'active' : ''}`}
              style={{
                ...styles.navBtn,
                backgroundColor: isActive ? 'rgba(212, 163, 115, 0.18)' : 'transparent',
                color: isActive ? '#D4A373' : '#FFFFFF',
                borderLeft: isActive ? '4px solid #D4A373' : '4px solid transparent',
              }}
            >
              <div className="btn-content" style={styles.btnContent}>
                <Icon
                  size={18}
                  color={isActive ? '#D4A373' : '#FFFFFF'}
                  style={{ flexShrink: 0, transition: 'color 0.2s ease' }}
                />
                <span
                  style={{
                    ...styles.btnLabel,
                    color: isActive ? '#D4A373' : '#FFFFFF',
                    fontWeight: isActive ? 700 : 600,
                  }}
                >
                  {item.label}
                </span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  style={{
                    ...styles.badge,
                    backgroundColor: item.badgeColor || '#D4A373',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={styles.footer}>
        <button
          onClick={onLogout}
          className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ease-in-out hover:translate-x-1 sidebar-nav-btn"
          style={{ ...styles.navBtn, ...styles.logoutBtn }}
        >
          <div className="btn-content" style={styles.btnContent}>
            <LogOut size={18} color="#FFFFFF" style={{ flexShrink: 0 }} />
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>LOGOUT</span>
          </div>
        </button>
      </div>
    </aside>
  );
};

const styles = {
  sidebar: {
    width: '260px',
    height: '100vh',
    background: 'rgba(12, 12, 15, 0.88)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '30px 16px',
    boxSizing: 'border-box' as const,
  },
  brandSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    marginBottom: '28px',
  },
  logoContainer: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  brandTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: '3px',
    textTransform: 'uppercase' as const,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    flex: 1,
    overflowY: 'auto' as const,
  },
  navBtn: {
    padding: '12px 14px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    letterSpacing: '0.5px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    textAlign: 'left' as const,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  btnContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
    minWidth: 0,
  },
  btnLabel: {
    whiteSpace: 'normal' as const,
    lineHeight: '1.2',
    wordBreak: 'break-word' as const,
  },
  badge: {
    fontSize: '0.7rem',
    fontWeight: '800',
    color: '#fff',
    backgroundColor: '#D4A373',
    padding: '2px 7px',
    borderRadius: '10px',
    lineHeight: '1.2',
    marginLeft: '6px',
    flexShrink: 0,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  logoutBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    color: '#FFFFFF',
  },
};
