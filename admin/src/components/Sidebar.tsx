import React from 'react';
import { 
  LayoutDashboard, 
  ChefHat, 
  Coffee, 
  ClipboardList, 
  PlusCircle, 
  BarChart3 
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lowStockCount: number;
  pendingRequestsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  lowStockCount, 
  pendingRequestsCount 
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'ingredients', label: 'Manage Ingredients', icon: ChefHat, badge: lowStockCount, badgeColor: 'bg-red' },
    { id: 'menu', label: 'Manage Menu', icon: Coffee },
    { id: 'requests', label: 'Manage Requests', icon: ClipboardList, badge: pendingRequestsCount, badgeColor: 'bg-blue' },
    { id: 'stockin', label: 'Record Stock In', icon: PlusCircle },
    { id: 'reports', label: 'View Reports', icon: BarChart3 }
  ];

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logoContainer}>
        <img 
          src="/logo.png" 
          alt="Break & Brews Logo" 
          style={styles.logoImage} 
        />
        <div style={styles.logoText}>
          <span style={styles.logoTitle}>BREAK & BREWS</span>
          <span style={styles.logoSubtitle}>Admin Portal</span>
        </div>
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
            >
              <div className="btn-content">
                <Icon size={20} className="nav-icon" />
                <span className="btn-label">
                  {item.label}
                </span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span style={{
                  ...styles.badge,
                  backgroundColor: item.badgeColor === 'bg-blue' ? '#3b82f6' : '#ef4444'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

const styles = {
  sidebar: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '24px 16px',
    boxSizing: 'border-box' as const
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '24px',
    borderBottom: '1px solid var(--border-glass)',
    marginBottom: '24px'
  },
  logoImage: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    objectFit: 'cover' as const
  },
  logoText: {
    display: 'flex',
    flexDirection: 'column' as const
  },
  logoTitle: {
    fontWeight: '800',
    fontSize: '1.1rem',
    letterSpacing: '0.05em',
    color: 'var(--text-primary)'
  },
  logoSubtitle: {
    fontWeight: '500',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
    marginTop: '2px'
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    flex: 1
  },
  badge: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '10px',
    lineHeight: '1.2'
  },
  footer: {
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-glass)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  },
  footerText: {
    fontSize: '0.75rem',
    color: '#10b981',
    fontWeight: '600'
  },
  footerVersion: {
    fontSize: '0.7rem',
    color: 'var(--text-dark)'
  }
};
