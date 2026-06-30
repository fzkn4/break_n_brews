import React, { useState } from 'react';
import { Key, Mail, Eye, EyeOff, AlertTriangle, Sun, Moon } from 'lucide-react';

interface LoginProps {
  onLogin: (user: { name: string; email: string; role: string }) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, theme, toggleTheme }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
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
          <p style={styles.brandSubtitle}>Admin & Staff Operations Portal</p>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <AlertTriangle size={18} color="#ef4444" />
            <span style={styles.errorText}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Work Email Address</label>
            <div style={styles.inputWrapper}>
              <Mail size={18} color="#9ca3af" style={styles.inputIcon} />
              <input
                type="email"
                placeholder="name@breakandbrews.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                className="glass-input"
                required
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Security Password</label>
            <div style={styles.inputWrapper}>
              <Key size={18} color="#9ca3af" style={styles.inputIcon} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                className="glass-input"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? <EyeOff size={18} color="#9ca3af" /> : <Eye size={18} color="#9ca3af" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={styles.submitBtn}
            className="btn btn-primary"
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
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
    backgroundColor: 'var(--bg-primary)',
    backgroundImage: 'var(--bg-gradient)',
    padding: '24px',
    boxSizing: 'border-box' as const,
    position: 'relative' as const
  },
  themeToggleWrapper: {
    position: 'absolute' as const,
    top: '24px',
    right: '24px',
    zIndex: 10
  },
  loginBox: {
    width: '100%',
    maxWidth: '460px',
    padding: '40px',
    backgroundColor: 'var(--card-bg)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--border-glass)',
    borderRadius: '24px',
    boxShadow: 'var(--card-shadow)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px'
  },
  brandHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const
  },
  logoContainer: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 0 20px rgba(245, 158, 11, 0.05)',
    overflow: 'hidden'
  },
  logoIcon: {
    filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.3))'
  },
  brandTitle: {
    margin: 0,
    fontSize: '1.6rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '2px'
  },
  brandSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontWeight: '500'
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    padding: '12px 16px',
    borderRadius: '12px'
  },
  errorText: {
    fontSize: '0.85rem',
    color: '#ef4444',
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
    gap: '8px'
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  },
  inputWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center'
  },
  inputIcon: {
    position: 'absolute' as const,
    left: '14px',
    pointerEvents: 'none' as const
  },
  input: {
    width: '100%',
    paddingLeft: '44px',
    paddingRight: '44px',
    boxSizing: 'border-box' as const,
    height: '46px',
    fontSize: '0.95rem'
  },
  eyeBtn: {
    position: 'absolute' as const,
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none'
  },
  submitBtn: {
    width: '100%',
    height: '46px',
    justifyContent: 'center',
    marginTop: '8px',
    fontSize: '0.95rem',
    fontWeight: '600'
  },
  dividerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '8px 0'
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'var(--border-glass)'
  },
  dividerText: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontWeight: '700',
    letterSpacing: '0.08em'
  },
  quickLoginList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px'
  },
  quickLoginInfo: {
    display: 'flex',
    flexDirection: 'column' as const
  },
  quickLoginName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  quickLoginDesc: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    marginTop: '2px'
  }
};
