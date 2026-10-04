import React, { useState } from 'react';
import { Key, User, Eye, EyeOff, AlertTriangle, Sun, Moon } from 'lucide-react';
import { API_URL } from '../App';

interface LoginProps {
  onLogin: (user: { name: string; email: string; role: string }) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, theme, toggleTheme }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      setError('Please enter your username');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: normalizedUsername,
          email: normalizedUsername,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onLogin({
          name: data.name,
          email: data.email,
          role: data.role,
        });
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection to authentication server failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.loginContainer}>
      {/* Floating Theme Switcher */}
      <div style={styles.themeToggleWrapper}>
        <button 
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>

      <div style={styles.loginBox} className="glass-card fade-in">
        {/* Brand Header */}
        <div style={styles.brandHeader}>
          <div style={styles.logoContainer}>
            <img 
              src="/break_and_brews.png" 
              alt="Break & Brews Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>
          <h2 style={styles.brandTitle}>BREAK & BREWS</h2>
          <p style={styles.brandSubtitle}>Admin</p>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <span style={styles.errorText}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <div style={styles.inputWrapper}>
              <User size={18} style={styles.inputIcon} />
              <input
                type="text"
                placeholder="name@breakandbrews.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <Key size={18} style={styles.inputIcon} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  loginContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100vw',
    backgroundImage: 'linear-gradient(rgba(14, 10, 8, 0.35), rgba(14, 10, 8, 0.35)), url("/login-bg.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    padding: '20px',
    boxSizing: 'border-box' as const,
    position: 'relative' as const
  },
  themeToggleWrapper: {
    position: 'absolute' as const,
    top: '20px',
    right: '20px',
    zIndex: 10
  },
  loginBox: {
    width: '100%',
    maxWidth: '430px',
    padding: '44px 36px',
    backgroundColor: 'rgba(18, 14, 11, 0.42)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '28px',
    boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    boxSizing: 'border-box' as const
  },
  brandHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const
  },
  logoContainer: {
    width: '68px',
    height: '68px',
    borderRadius: '18px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 0 25px rgba(245, 158, 11, 0.25)',
    overflow: 'hidden'
  },
  brandTitle: {
    margin: 0,
    fontSize: '1.65rem',
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: '2.5px',
    textTransform: 'uppercase' as const,
    textShadow: '0 2px 10px rgba(0,0,0,0.5)'
  },
  brandSubtitle: {
    margin: '6px 0 0 0',
    fontSize: '0.85rem',
    color: '#f59e0b',
    fontWeight: '600',
    letterSpacing: '1.5px',
    textTransform: 'uppercase' as const,
    textShadow: '0 1px 6px rgba(0,0,0,0.6)'
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    padding: '12px 16px',
    borderRadius: '14px'
  },
  errorText: {
    fontSize: '0.85rem',
    color: '#fca5a5',
    fontWeight: '500'
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px'
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    textAlign: 'center' as const,
    width: '100%',
    textShadow: '0 1px 4px rgba(0,0,0,0.5)'
  },
  inputWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    width: '100%'
  },
  inputIcon: {
    position: 'absolute' as const,
    left: '16px',
    pointerEvents: 'none' as const,
    color: 'rgba(245, 158, 11, 0.85)'
  },
  input: {
    width: '100%',
    paddingLeft: '48px',
    paddingRight: '48px',
    boxSizing: 'border-box' as const,
    height: '48px',
    fontSize: '0.95rem',
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    border: '1px solid rgba(255, 255, 255, 0.22)',
    borderRadius: '14px',
    color: '#ffffff',
    textAlign: 'center' as const,
    outline: 'none',
    transition: 'all 0.2s ease-in-out'
  },
  eyeBtn: {
    position: 'absolute' as const,
    right: '14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    color: 'rgba(255, 255, 255, 0.65)'
  },
  submitBtn: {
    width: '100%',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8px',
    fontSize: '1rem',
    fontWeight: '700',
    color: '#0f0c0a',
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    border: 'none',
    borderRadius: '14px',
    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.35)',
    letterSpacing: '0.5px',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
  }
};
