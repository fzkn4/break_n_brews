import { Coffee, Receipt, ShoppingBag, Store } from 'lucide-react';
import type { View } from '../types';

interface HeaderProps {
  view: View;
  onNavigate: (view: View) => void;
  cartCount: number;
  onOpenCart: () => void;
  hasLiveOrder: boolean;
}

const NAV: { view: View; label: string }[] = [
  { view: 'home', label: 'Home' },
  { view: 'menu', label: 'Order Menu' },
  { view: 'tracker', label: 'My Orders' }
];

export default function Header({ view, onNavigate, cartCount, onOpenCart, hasLiveOrder }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <button className="brand" onClick={() => onNavigate('home')} aria-label="Break and Brews home">
          <img className="brand__mark" src="/break_and_brews.png" alt="" />
          <span className="brand__name">BREAK &amp; BREWS</span>
        </button>

        <nav className="nav-links" aria-label="Main">
          {NAV.map((entry) => (
            <button
              key={entry.view}
              className={`nav-link${view === entry.view ? ' is-active' : ''}`}
              aria-current={view === entry.view ? 'page' : undefined}
              onClick={() => onNavigate(entry.view)}
            >
              {entry.label}
              {entry.view === 'tracker' && hasLiveOrder && (
                <span className="nav-link__dot" aria-label="order in progress" />
              )}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <button className="cart-button" onClick={onOpenCart} aria-label={`Open cart, ${cartCount} items`}>
            <ShoppingBag size={20} />
            {cartCount > 0 && <span className="count-badge">{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

const TABS: { view: View; label: string; Icon: typeof Coffee }[] = [
  { view: 'home', label: 'Home', Icon: Store },
  { view: 'menu', label: 'Menu', Icon: Coffee },
  { view: 'tracker', label: 'Orders', Icon: Receipt }
];

export function TabBar({ view, onNavigate, cartCount, onOpenCart, hasLiveOrder }: HeaderProps) {
  return (
    <nav className="tabbar" aria-label="Primary">
      <div className="tabbar__inner">
        {TABS.map((tab) => (
          <button
            key={tab.view}
            className={`tabbar__item${view === tab.view ? ' is-active' : ''}`}
            aria-current={view === tab.view ? 'page' : undefined}
            onClick={() => onNavigate(tab.view)}
          >
            <tab.Icon size={20} />
            <span>{tab.label}</span>
            {tab.view === 'tracker' && hasLiveOrder && <span className="nav-link__dot" />}
          </button>
        ))}
        <button className="tabbar__item" onClick={onOpenCart} aria-label={`Open cart, ${cartCount} items`}>
          <ShoppingBag size={20} />
          <span>Cart</span>
          {cartCount > 0 && <span className="count-badge">{cartCount}</span>}
        </button>
      </div>
    </nav>
  );
}
