import React from 'react';
import { LayoutDashboard, Package, UtensilsCrossed, FileText, AlertTriangle, LogOut } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  pendingOrdersCount: number;
  pendingRequestsCount?: number;
  lowStockCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  pendingOrdersCount,
  pendingRequestsCount = 0,
  lowStockCount = 0,
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'orders', label: 'ORDER QUEUE', icon: Package, badge: pendingOrdersCount },
    { id: 'menu', label: 'MENU', icon: UtensilsCrossed },
    { id: 'requests', label: 'INGREDIENTS SUPPLY REQUEST', icon: FileText, badge: pendingRequestsCount },
    { id: 'alerts', label: 'INVENTORY ALERT', icon: AlertTriangle, badge: lowStockCount, badgeColor: '#ef4444' },
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
              className={`group flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ease-in-out hover:translate-x-2 hover:bg-amber-500/10 hover:text-amber-500 active:scale-95 sidebar-nav-btn ${isActive ? 'active border-l-4 border-amber-500' : ''}`}
              style={styles.navBtn}
            >
              <div className="btn-content" style={styles.btnContent}>
                <Icon size={18} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                <span style={styles.btnLabel} className="group-hover:text-amber-500 font-medium">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span style={{
                  ...styles.badge,
                  backgroundColor: item.badgeColor || 'var(--accent-primary)'
                }}>
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
          className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ease-in-out hover:translate-x-2 hover:bg-amber-500/10 hover:text-amber-500 active:scale-95 sidebar-nav-btn"
          style={{ ...styles.navBtn, ...styles.logoutBtn }}
        >
          <div className="btn-content" style={styles.btnContent}>
            <LogOut size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <span className="group-hover:text-amber-500 font-medium">LOGOUT</span>
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
    backgroundColor: 'var(--sidebar-bg)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRight: '1px solid var(--sidebar-border)',
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
    backgroundColor: 'rgba(148, 118, 86, 0.05)',
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
    color: '#4a3f35',
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
    backgroundColor: 'var(--accent-primary)',
    padding: '2px 7px',
    borderRadius: '10px',
    lineHeight: '1.2',
    marginLeft: '6px',
    flexShrink: 0,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid var(--sidebar-border)',
  },
  logoutBtn: {
    width: '100%',
  },
};

