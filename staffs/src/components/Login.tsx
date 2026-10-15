import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertTriangle, Coffee, Sun, Moon, X, ArrowRight } from 'lucide-react';
import { API_URL } from '../App';

interface LoginProps {
  onLogin: (user: { name: string; email: string; role: string }) => void;
  theme?: 'dark' | 'light';
  toggleTheme?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, theme, toggleTheme }) => {
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [internalTheme, setInternalTheme] = useState<'dark' | 'light'>('dark');

  const activeTheme = theme || internalTheme;

  const handleToggleTheme = () => {
    if (toggleTheme) {
      toggleTheme();
    } else {
      setInternalTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      setError('Please enter your email or username');
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
    <div style={styles.pageWrapper}>
      {/* Top Navbar */}
      <header style={styles.topNav}>
        <div style={styles.navBrand}>
          <Coffee size={22} color="#f59e0b" style={{ marginRight: '8px' }} />
          <span style={styles.navBrandText}>Break&amp;brews</span>
        </div>
        <nav style={styles.navLinks}>
          <span style={styles.navLink}>Home</span>
          <span style={styles.navLink}>About</span>
          <span style={styles.navLink}>Menu</span>
          <span style={styles.navLink}>Reviews</span>
          <span style={styles.navLink}>Contact</span>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={handleToggleTheme}
            title={activeTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            style={styles.navThemeBtn}
          >
            {activeTheme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </nav>
      </header>

      {/* Main Split Section */}
      <main style={styles.mainContainer}>
        {/* Left Side: Welcome Headline */}
        <div style={styles.leftCol}>
          <h1 style={styles.heroTitle}>
            Welcome back to our<br />
            <span style={{ color: '#ffffff' }}>Break&amp;brews</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Your dashboard to manage stock, plan brews, and check caf&eacute; performance awaits.
          </p>
          <div>
            <button
              type="button"
              className="get-started-cta"
              onClick={() => {
                setShowLoginForm((prev) => {
                  const next = !prev;
                  if (next) {
                    setTimeout(() => {
                      const input = document.getElementById('staff-email-input');
                      input?.focus();
                    }, 150);
                  }
                  return next;
                });
              }}
            >
              <span>Get Started</span>
              <ArrowRight size={18} style={{ transform: showLoginForm ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s ease' }} />
            </button>
          </div>
        </div>

        {/* Right Side: Staff Login Card (Hidden initially, revealed on Get Started click) */}
        {showLoginForm && (
          <div style={styles.rightCol}>
            <div style={styles.loginCard} className="glass-card login-fade-in">
              <div style={styles.cardHeaderRow}>
                <h2 style={styles.cardHeader}>Staff Login</h2>
                <button
                  type="button"
                  onClick={() => setShowLoginForm(false)}
                  style={styles.closeCardBtn}
                  title="Close login form"
                  aria-label="Close login form"
                >
                  <X size={18} />
                </button>
              </div>

            {error && (
              <div style={styles.errorAlert}>
                <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                <span style={styles.errorText}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.inputGroup}>
                <label style={styles.label} htmlFor="staff-email-input">Email</label>
                <div style={styles.inputWrapper}>
                  <Mail size={16} style={styles.inputIcon} />
                  <input
                    id="staff-email-input"
                    type="text"
                    placeholder="Enter your email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label} htmlFor="staff-password-input">Password</label>
                <div style={styles.inputWrapper}>
                  <Lock size={16} style={styles.inputIcon} />
                  <input
                    id="staff-password-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
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
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={styles.rememberRow}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span>Remember me</span>
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    setError('Please contact your system manager to reset your password.');
                  }}
                  style={styles.forgotLink}
                >
                  Forgot Password?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.submitBtn,
                  opacity: loading ? 0.75 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Logging in…' : 'Login'}
              </button>

              <div style={styles.cardFooter}>
                <span>Not a member? </span>
                <span style={styles.footerLink}>Sign up now</span>
              </div>
            </form>
          </div>
        </div>
        )}
      </main>
    </div>
  );
};

const styles = {
  pageWrapper: {
    minHeight: '100vh',
    width: '100vw',
    backgroundImage: 'url("/src/assets/login-bg.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    backgroundRepeat: 'no-repeat',
    display: 'flex',
    flexDirection: 'column' as const,
    boxSizing: 'border-box' as const,
    color: '#ffffff',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  topNav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '28px 24px 10px',
    boxSizing: 'border-box' as const,
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
  },
  navBrandText: {
    fontSize: '1.25rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#ffffff',
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  navLink: {
    fontSize: '0.88rem',
    color: 'rgba(255, 255, 255, 0.85)',
    cursor: 'pointer',
    transition: 'color 0.15s ease',
  },
  navThemeBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#ffffff',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    marginLeft: '6px',
  },
  mainContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: '1240px',
    margin: '0 auto',
    padding: '20px 24px 60px',
    boxSizing: 'border-box' as const,
    flexWrap: 'wrap' as const,
    gap: '40px',
  },
  leftCol: {
    flex: '1 1 500px',
    maxWidth: '640px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    textAlign: 'left' as const,
  },
  heroTitle: {
    margin: 0,
    fontSize: 'clamp(3rem, 5.5vw, 4.25rem)',
    fontWeight: 800,
    lineHeight: 1.12,
    letterSpacing: '-0.03em',
    color: '#ffffff',
    textShadow: '0 3px 20px rgba(0, 0, 0, 0.75)',
  },
  heroSubtitle: {
    margin: '22px 0 34px',
    fontSize: '1.12rem',
    lineHeight: 1.6,
    color: 'rgba(255, 255, 255, 0.9)',
    maxWidth: '520px',
    textShadow: '0 1px 8px rgba(0,0,0,0.65)',
  },
  getStartedBtn: {
    display: 'inline-block',
    padding: '11px 32px',
    borderRadius: '999px',
    background: 'transparent',
    border: '1.5px solid rgba(255, 255, 255, 0.85)',
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  rightCol: {
    flex: '0 1 430px',
    width: '100%',
    maxWidth: '430px',
    margin: '0 auto',
  },
  loginCard: {
    background: 'rgba(18, 18, 20, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '38px 34px',
    boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.65)',
    textAlign: 'left' as const,
    boxSizing: 'border-box' as const,
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  cardHeader: {
    margin: 0,
    fontSize: '1.65rem',
    fontWeight: 700,
    textAlign: 'left' as const,
    color: '#ffffff',
    letterSpacing: '-0.01em',
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  closeCardBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: 'rgba(255, 255, 255, 0.75)',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    padding: '10px 14px',
    borderRadius: '12px',
    marginBottom: '18px',
  },
  errorText: {
    fontSize: '0.82rem',
    color: '#fca5a5',
    fontWeight: 500,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: '#E2E8F0',
    textShadow: '0 1px 4px rgba(0,0,0,0.4)',
  },
  inputWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  inputIcon: {
    position: 'absolute' as const,
    left: '16px',
    color: 'rgba(255, 255, 255, 0.65)',
    pointerEvents: 'none' as const,
  },
  input: {
    width: '100%',
    height: '46px',
    paddingLeft: '44px',
    paddingRight: '44px',
    borderRadius: '999px',
    border: '1px solid rgba(255, 255, 255, 0.28)',
    background: 'rgba(0, 0, 0, 0.35)',
    color: '#FFFFFF',
    fontSize: '0.9rem',
    boxSizing: 'border-box' as const,
    outline: 'none',
    transition: 'border-color 0.2s ease, background 0.2s ease',
  },
  eyeBtn: {
    position: 'absolute' as const,
    right: '14px',
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.65)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.78rem',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: '2px',
    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
  },
  checkboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  checkbox: {
    cursor: 'pointer',
    accentColor: '#6e4730',
  },
  forgotLink: {
    color: 'rgba(255, 255, 255, 0.85)',
    textDecoration: 'none',
    fontSize: '0.78rem',
  },
  submitBtn: {
    width: '100%',
    height: '46px',
    marginTop: '6px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #7c4a2d 0%, #5c351f 100%)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 18px rgba(0, 0, 0, 0.45)',
    transition: 'background 0.2s ease, transform 0.1s ease',
  },
  cardFooter: {
    textAlign: 'center' as const,
    fontSize: '0.8rem',
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: '8px',
    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
  },
  footerLink: {
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
};
