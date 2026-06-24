import React, { useState } from 'react';
import { Coffee, Key, Mail, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface LoginProps {
  onLogin: (user: { name: string; email: string; role: string }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Seeded accounts info for quick login
  const accounts = [
    { name: 'Marcus Aurelius', email: 'marcus@breakandbrews.com', role: 'admin', desc: 'System Administrator / Owner' },
    { name: 'John Doe', email: 'john@breakandbrews.com', role: 'staff', desc: 'Lead Barista' },
    { name: 'Jane Smith', email: 'jane@breakandbrews.com', role: 'staff', desc: 'Barista / Inventory' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setError('Please enter your email address');
        setLoading(false);
        return;
      }

      if (normalizedEmail === 'robert@breakandbrews.com') {
        setError('This account is currently deactivated. Please contact your manager.');
        setLoading(false);
        return;
      }

      const match = accounts.find(acc => acc.email.toLowerCase() === normalizedEmail);
      if (match) {
        onLogin({ name: match.name, email: match.email, role: match.role });
      } else {
        // Fallback for custom user email
        onLogin({
          name: email.split('@')[0] || 'Guest User',
          email: normalizedEmail,
          role: 'staff'
        });
      }
      setLoading(false);
    }, 800);
  };

  const handleQuickLogin = (acc: typeof accounts[0]) => {
    setLoading(true);
    setTimeout(() => {
      onLogin({ name: acc.name, email: acc.email, role: acc.role });
      setLoading(false);
    }, 400);
  };

  return (
    <div style={styles.loginContainer}>
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

        <div style={styles.dividerContainer}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>QUICK DEMO ACCESSIBILITY</span>
          <div style={styles.dividerLine} />
        </div>

        <div style={styles.quickLoginList}>
          {accounts.map((acc) => (
            <button
              key={acc.email}
              onClick={() => handleQuickLogin(acc)}
              className="quick-login-btn"
              type="button"
              disabled={loading}
            >
              <div style={styles.quickLoginInfo}>
                <span style={styles.quickLoginName}>{acc.name}</span>
                <span style={styles.quickLoginDesc}>{acc.desc}</span>
              </div>
              <span className={acc.role === 'admin' ? 'badge badge-available' : 'badge badge-maintenance'}>
                {acc.role}
              </span>
            </button>
          ))}
        </div>
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
    backgroundColor: '#0b0b0e',
    backgroundImage: `
      radial-gradient(circle at 10% 20%, rgba(245, 158, 11, 0.05) 0%, transparent 40%),
      radial-gradient(circle at 90% 80%, rgba(124, 58, 237, 0.06) 0%, transparent 45%)
    `,
    padding: '24px',
    boxSizing: 'border-box' as const
  },
  loginBox: {
    width: '100%',
    maxWidth: '460px',
    padding: '40px',
    backgroundColor: 'rgba(18, 18, 23, 0.65)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '24px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
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
    color: '#fff',
    letterSpacing: '2px'
  },
  brandSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: '#9ca3af',
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
    color: '#9ca3af',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  dividerText: {
    fontSize: '0.7rem',
    color: '#9ca3af',
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
    color: '#fff'
  },
  quickLoginDesc: {
    fontSize: '0.7rem',
    color: '#9ca3af',
    marginTop: '2px'
  }
};
