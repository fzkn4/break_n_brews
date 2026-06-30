import React from 'react';
import { LayoutDashboard, Package, LogOut, Sun, Moon } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  pendingOrdersCount: number;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  pendingOrdersCount,
  theme,
  toggleTheme,
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'orders', label: 'ORDER QUEUE', icon: Package, badge: pendingOrdersCount },
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
              className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
              style={styles.navBtn}
            >
              <div className="btn-content" style={styles.btnContent}>
                <Icon size={20} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span style={styles.badge}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={styles.footer}>
        <button
          onClick={toggleTheme}
          className="sidebar-nav-btn"
          style={{ ...styles.navBtn, marginBottom: '12px', width: '100%' }}
        >
          <div className="btn-content" style={styles.btnContent}>
            {theme === 'light' ? (
              <>
                <Moon size={20} color="var(--text-muted)" />
                <span>DARK MODE</span>
              </>
            ) : (
              <>
                <Sun size={20} color="var(--text-muted)" />
                <span>LIGHT MODE</span>
              </>
            )}
          </div>
        </button>

        <button
          onClick={onLogout}
          className="sidebar-nav-btn"
          style={{ ...styles.navBtn, ...styles.logoutBtn }}
        >
          <div className="btn-content" style={styles.btnContent}>
            <LogOut size={20} color="var(--text-muted)" />
            <span>LOGOUT</span>
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
    borderRight: '1px solid var(--sidebar-border)',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '40px 20px',
    boxSizing: 'border-box' as const,
  },
  brandSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    marginBottom: '48px',
  },
  logoContainer: {
    width: '100px',
    height: '100px',
    borderRadius: '24px',
    backgroundColor: 'rgba(148, 118, 86, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  brandTitle: {
    margin: 0,
    fontSize: '1.8rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '3px',
    textTransform: 'uppercase' as const,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    flex: 1,
  },
  navBtn: {
    padding: '14px 20px',
    borderRadius: '14px',
    fontSize: '0.9rem',
    letterSpacing: '1px',
    fontWeight: '700',
  },
  btnContent: {
    gap: '16px',
  },
  badge: {
    fontSize: '0.75rem',
    fontWeight: '800',
    color: '#fff',
    backgroundColor: 'var(--accent-primary)',
    padding: '2px 8px',
    borderRadius: '10px',
    lineHeight: '1.2',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: '20px',
    borderTop: '1px solid var(--sidebar-border)',
  },
  logoutBtn: {
    width: '100%',
  },
};
