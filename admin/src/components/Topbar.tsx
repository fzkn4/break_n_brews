import React, { useState, useEffect } from 'react';
import { Clock, ChevronDown, Menu, LogOut, User, Settings } from 'lucide-react';

interface TopbarProps {
  activeTab: string;
  onToggleSidebar?: () => void;
  currentUser: { name: string; email: string; role: string } | null;
  onLogout: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ activeTab, onToggleSidebar, currentUser, onLogout }) => {
  const [time, setTime] = useState(new Date());
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    const handleOutsideClick = () => setShowDropdown(false);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showDropdown]);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard Overview';
      case 'ingredients': return 'Manage Ingredients';
      case 'menu': return 'Manage Cafe Menu';
      case 'requests': return 'Manage Staff Requests';
      case 'stockin': return 'Record Stock In';
      case 'reports': return 'View Reports';
      default: return 'Break & Brews';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const name = currentUser?.name || 'Marcus Aurelius';
  const role = currentUser?.role || 'admin';
  const email = currentUser?.email || 'marcus@breakandbrews.com';

  return (
    <header style={styles.topbar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={onToggleSidebar}
          className="mobile-menu-btn"
        >
          <Menu size={20} />
        </button>
        <h1 style={styles.title}>{getPageTitle()}</h1>
      </div>

      <div style={styles.rightSection}>
        {/* Live Clock */}
        <div style={styles.clockContainer}>
          <Clock size={16} color="#f59e0b" />
          <span style={styles.clockText}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* User profile dropdown container */}
        <div className="profile-container">
          <button 
            className="profile-btn" 
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
          >
            <div style={styles.avatar}>{getInitials(name)}</div>
            <div style={styles.userInfo}>
              <span style={styles.userName}>{name}</span>
              <span style={styles.userRole}>{role === 'admin' ? 'Owner / Admin' : 'Staff Member'}</span>
            </div>
            <ChevronDown size={14} color="#9ca3af" style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>

          {showDropdown && (
            <div className="profile-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="dropdown-header">
                <span style={styles.userName}>{name}</span>
                <span className="dropdown-email">{email}</span>
              </div>
              
              <button className="dropdown-item" style={{ opacity: 0.6, cursor: 'not-allowed' }} disabled>
                <User size={16} color="#9ca3af" />
                <span>My Profile</span>
              </button>
              
              <button className="dropdown-item" style={{ opacity: 0.6, cursor: 'not-allowed' }} disabled>
                <Settings size={16} color="#9ca3af" />
                <span>Settings</span>
              </button>
              
              <button 
                className="dropdown-item dropdown-item-danger" 
                onClick={() => {
                  setShowDropdown(false);
                  onLogout();
                }}
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const styles = {
  topbar: {
    height: '70px',
    backgroundColor: '#0b0b0e',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    position: 'sticky' as const,
    top: 0,
    zIndex: 90,
    backdropFilter: 'blur(8px)'
  },
  title: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: '700',
    color: '#fff'
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  clockContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(245, 158, 11, 0.15)'
  },
  clockText: {
    fontSize: '0.85rem',
    color: '#f59e0b',
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#7c3aed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: '600',
    fontSize: '0.85rem'
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    textAlign: 'left' as const
  },
  userName: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#fff'
  },
  userRole: {
    fontSize: '0.7rem',
    color: '#9ca3af'
  }
};
