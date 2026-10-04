import { useState } from 'react';
import {
  ArrowRight,
  Award,
  Check,
  Clock,
  Coffee,
  Flame,
  Heart,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star
} from 'lucide-react';
import ProductCard from './ProductCard';
import CategoryRail from './CategoryRail';
import StarRating from './StarRating';
import { CUSTOMIZATION_LEVELS, categoriesFrom } from '../lib/catalog';
import type { Availability } from '../lib/catalog';
import type { MenuItem, Order, Review } from '../types';

interface HomeViewProps {
  menuItems: MenuItem[];
  loading: boolean;
  favorites: number[];
  liveOrder: Order | null;
  reviews: Review[];
  availabilityFor: (item: MenuItem) => Availability;
  onOpen: (item: MenuItem) => void;
  onToggleFavorite: (id: number) => void;
  onBrowse: (category?: string) => void;
  onTrack: () => void;
  onSubscribe: (email: string) => Promise<boolean>;
}

export default function HomeView({
  menuItems,
  loading,
  favorites,
  liveOrder,
  reviews,
  availabilityFor,
  onOpen,
  onToggleFavorite,
  onBrowse,
  onTrack,
  onSubscribe
}: HomeViewProps) {
  const categories = categoriesFrom(menuItems).filter((category) => category !== 'All');

  const drinks = menuItems.filter((item) => /coffee|drink|tea/i.test(item.category)).slice(0, 4);
  const kitchen = menuItems.filter((item) => !/coffee|drink|tea/i.test(item.category)).slice(0, 4);
  const saved = menuItems.filter((item) => favorites.includes(item.id)).slice(0, 4);

  const renderGrid = (items: MenuItem[]) => (
    <div className="product-grid">
      {items.map((item) => (
        <ProductCard
          key={item.id}
          item={item}
          availability={availabilityFor(item)}
          isFavorite={favorites.includes(item.id)}
          onOpen={onOpen}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );

  return (
    <>
      {/* 1. HERO SECTION (CONTAINER ISOLATED VIDEO BACKGROUND) */}
      <section className="hero">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="hero__video"
          src="/videos/hero-video.mp4"
        />
        <div className="hero__scrim" aria-hidden="true" />
        <div className="shell hero__inner">
          <div>
            <div className="hero__badge-row">
              <span className="hero__eyebrow">
                <Star size={13} fill="currentColor" style={{ display: 'inline', marginRight: 6 }} />
                Loved by 25,000+ Coffee Lovers
              </span>
            </div>

            <h1 className="hero__title">Every Sip Tells a Story</h1>
            <p className="hero__tagline">“Take a break. Enjoy your brew.”</p>

            <div className="hero__actions">
              <button className="btn btn-primary btn-lg" onClick={() => onBrowse()}>
                Shop Coffee
                <ArrowRight size={17} />
              </button>
              <button className="btn btn-outline-white btn-lg" onClick={onTrack}>
                Track Order
              </button>
            </div>

            <dl className="hero__stats">
              <div>
                <dd className="hero__stat-value">{menuItems.length || '—'}</dd>
                <dt className="hero__stat-label">Signature Items</dt>
              </div>
              <div>
                <dd className="hero__stat-value">{CUSTOMIZATION_LEVELS.length}</dd>
                <dt className="hero__stat-label">Custom Levels</dt>
              </div>
              <div>
                <dd className="hero__stat-value">Live</dd>
                <dt className="hero__stat-label">Counter Tracking</dt>
              </div>
            </dl>
          </div>

          <div className="hero__cup">
            <img src="/break_and_brews.png" alt="Break & Brews latte art signature" />
          </div>
        </div>
      </section>

      {/* 2. VALUE PROPOSITION BAR */}
      <section className="value-bar">
        <div className="shell value-bar__inner">
          <div className="value-item">
            <div className="value-item__icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="value-item__title">ETHICALLY SOURCED</h4>
              <p className="value-item__desc">100% Single-Origin Beans</p>
            </div>
          </div>

          <div className="value-item">
            <div className="value-item__icon">
              <Flame size={22} />
            </div>
            <div>
              <h4 className="value-item__title">SMALL BATCH ROASTED</h4>
              <p className="value-item__desc">Micro-Roasted Fresh Daily</p>
            </div>
          </div>

          <div className="value-item">
            <div className="value-item__icon">
              <RefreshCw size={22} />
            </div>
            <div>
              <h4 className="value-item__title">LIVE ORDER TRACKING</h4>
              <p className="value-item__desc">Real-Time Kitchen Updates</p>
            </div>
          </div>

          <div className="value-item">
            <div className="value-item__icon">
              <Award size={22} />
            </div>
            <div>
              <h4 className="value-item__title">SATISFACTION GUARANTEED</h4>
              <p className="value-item__desc">Crafted with Barista Care</p>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE ORDER STRIP */}
      {liveOrder && (
        <div className="order-strip">
          <div className="shell order-strip__inner">
            <Clock size={20} />
            <p className="order-strip__text">
              Order <strong>#{liveOrder.id}</strong> is{' '}
              <strong>{liveOrder.status === 'pending' ? 'with the barista' : liveOrder.status}</strong>.
            </p>
            <button className="btn btn-white btn-sm" onClick={onTrack}>
              Follow it live
            </button>
          </div>
        </div>
      )}

      {/* CATEGORY RAIL */}
      {categories.length > 0 && (
        <div className="category-band">
          <div className="shell">
            <CategoryRail
              categories={categories}
              selected=""
              variant="links"
              onSelect={(category) => onBrowse(category)}
            />
          </div>
        </div>
      )}

      {/* SAVED FAVORITES */}
      {saved.length > 0 && (
        <section className="section shell">
          <div className="section-head">
            <span className="section-eyebrow">
              <Heart size={12} style={{ display: 'inline', marginRight: 5 }} />
              Saved by you
            </span>
            <h2 className="section-title">Your usual order</h2>
            <p className="section-subtitle">The items you keep coming back for, one tap away.</p>
          </div>
          {renderGrid(saved)}
        </section>
      )}

      {/* 3. SIGNATURE BLENDS GRID */}
      <section className="section shell">
        <div className="section-head">
          <span className="section-eyebrow">
            <Coffee size={13} style={{ display: 'inline', marginRight: 6 }} />
            From the Bar
          </span>
          <h2 className="section-title">Our Signature Blends</h2>
          <p className="section-subtitle">
            Pulled to order and adjustable down to syrup &amp; ice — pick a drink and craft it your way.
          </p>
        </div>
        {loading ? <SkeletonGrid /> : renderGrid(drinks)}
      </section>

      {/* 4. SECONDARY FEATURED BANNER (/images/banner-bg.jpg) */}
      <section className="feature-banner">
        <div className="feature-banner__overlay" />
        <div className="shell feature-banner__inner">
          <span className="feature-banner__badge">
            <Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />
            Featured Artisanal Menu
          </span>
          <h2 className="feature-banner__title">Handcrafted Coffee &amp; Freshly Baked Delights</h2>
          <p className="feature-banner__text">
            Every drink is built from premium fresh ingredients prepped daily by our baristas and kitchen staff.
            Pair your favorite roast with a warm croissant or fresh rice bowl.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => onBrowse()}>
            Explore Full Menu
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* 5. FOOD & PASTRY ACCENT GRID SECTION (/images/pastry-bg.jpg) */}
      {kitchen.length > 0 && (
        <section className="pastry-accent-section">
          <div className="shell">
            <div className="section-head">
              <span className="section-eyebrow">From the Kitchen</span>
              <h2 className="section-title">Plates, Pastries &amp; Savory Meals</h2>
              <p className="section-subtitle">Fresh rice bowls, golden pastries, and sharing platters.</p>
            </div>
            {renderGrid(kitchen)}
          </div>
        </section>
      )}

      {/* 6. PROCESS INDICATOR: FROM BEAN TO BREW IN 4 STEPS */}
      <section className="process-section">
        <div className="shell">
          <div className="section-head">
            <span className="section-eyebrow">The Crafting Journey</span>
            <h2 className="section-title">From Bean to Brew in 4 Steps</h2>
            <p className="section-subtitle">How we make every cup special, from counter to your table.</p>
          </div>

          <div className="process-grid">
            <div className="process-card">
              <div className="process-card__step">01</div>
              <h3 className="process-card__title">Choose Blend</h3>
              <p className="process-card__text">
                Browse our curated menu of signature roasts, artisanal teas, and house-made pastries.
              </p>
            </div>

            <div className="process-card">
              <div className="process-card__step">02</div>
              <h3 className="process-card__title">Kitchen Prep</h3>
              <p className="process-card__text">
                Our baristas measure single-origin beans and pull rich espresso shots fresh to order.
              </p>
            </div>

            <div className="process-card">
              <div className="process-card__step">03</div>
              <h3 className="process-card__title">Pack &amp; Ready</h3>
              <p className="process-card__text">
                Custom milk, sweetness, and ice levels are hand-mixed to your exact specifications.
              </p>
            </div>

            <div className="process-card">
              <div className="process-card__step">04</div>
              <h3 className="process-card__title">Brew &amp; Enjoy</h3>
              <p className="process-card__text">
                Follow your order status live on screen as it gets served straight to your table.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. TESTIMONIAL SECTION ("Words from Our Coffee Family") */}
      {reviews.length > 0 && (
        <section className="section shell">
          <div className="section-head">
            <span className="section-eyebrow">Words from Our Coffee Family</span>
            <h2 className="section-title">Loved by Our Community</h2>
            <p className="section-subtitle">
              Real reviews left by customers who visited Break &amp; Brews.
            </p>
          </div>
          <div className="review-grid">
            {reviews.map((review) => (
              <article className="review-card" key={review.id}>
                <div className="review-card__head">
                  <span className="review-card__avatar" aria-hidden="true">
                    {review.customer_name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="review-card__name">{review.customer_name}</h3>
                    <span className="review-card__role">
                      {review.role || 'Verified Coffee Lover'}
                    </span>
                  </div>
                  <div className="review-card__stars">
                    <StarRating value={review.rating} size={14} />
                  </div>
                </div>
                <p className="review-card__text">“{review.comment}”</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 8. SUBSCRIPTION / NEWSLETTER FOOTER BANNER */}
      <section className="newsletter">
        <div className="newsletter__overlay" />
        <div className="shell newsletter__inner">
          <h2 className="section-title section-title--light">Start Your Coffee Journey Today</h2>
          <p className="section-subtitle section-subtitle--light">
            Subscribe for seasonal roasts, new menu alerts, and an exclusive 15% discount on your next order.
          </p>
          <NewsletterForm onSubscribe={onSubscribe} />
        </div>
      </section>
    </>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton-block skeleton-block--media" />
          <div className="skeleton-block skeleton-block--line" />
          <div className="skeleton-block skeleton-block--line short" />
          <div style={{ height: 12 }} />
        </div>
      ))}
    </div>
  );
}

function NewsletterForm({ onSubscribe }: { onSubscribe: (email: string) => Promise<boolean> }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');

  if (state === 'done') {
    return (
      <p className="newsletter__done">
        <Check size={18} />
        You are on the list — watch your inbox for the discount code.
      </p>
    );
  }

  return (
    <form
      className="newsletter__form"
      onSubmit={async (event) => {
        event.preventDefault();
        setState('sending');
        const ok = await onSubscribe(email.trim());
        setState(ok ? 'done' : 'idle');
        if (ok) setEmail('');
      }}
    >
      <label className="visually-hidden" htmlFor="newsletter-email">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        placeholder="Enter your email address"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Subscribing…' : 'Subscribe'}
      </button>
    </form>
  );
}
