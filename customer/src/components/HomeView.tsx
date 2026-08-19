import { useState } from 'react';
import { ArrowRight, Check, Clock, Heart } from 'lucide-react';
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
      <section className="hero">
        <div className="hero__media" aria-hidden="true" />
        <div className="hero__scrim" aria-hidden="true" />
        <div className="shell hero__inner">
          <div>
            <span className="hero__eyebrow">Welcome</span>
            <h1 className="hero__title">We serve the richest coffee in the city</h1>
            <p className="hero__tagline">“Take a break. Enjoy your brew.”</p>

            <div className="hero__actions">
              <button className="btn btn-white btn-lg" onClick={() => onBrowse()}>
                Order now
                <ArrowRight size={17} />
              </button>
              <button className="btn btn-outline-white btn-lg" onClick={onTrack}>
                Track my order
              </button>
            </div>

            <dl className="hero__stats">
              <div>
                <dd className="hero__stat-value">{menuItems.length || '—'}</dd>
                <dt className="hero__stat-label">Items on the menu</dt>
              </div>
              <div>
                <dd className="hero__stat-value">{CUSTOMIZATION_LEVELS.length}</dd>
                <dt className="hero__stat-label">Ways to customise</dt>
              </div>
              <div>
                <dd className="hero__stat-value">Live</dd>
                <dt className="hero__stat-label">Order tracking</dt>
              </div>
            </dl>
          </div>

          <div className="hero__cup">
            <img src="/break_and_brews.png" alt="Break and Brews latte art" />
          </div>
        </div>
      </section>

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

      {saved.length > 0 && (
        <section className="section shell">
          <div className="section-head">
            <span className="section-eyebrow">
              <Heart size={12} style={{ display: 'inline', marginRight: 5 }} />
              Saved by you
            </span>
            <h2 className="section-title">Your usual order</h2>
            <p className="section-subtitle">The things you keep coming back for, one tap away.</p>
          </div>
          {renderGrid(saved)}
        </section>
      )}

      <section className="section shell">
        <div className="section-head">
          <span className="section-eyebrow">From the bar</span>
          <h2 className="section-title">Our special coffee</h2>
          <p className="section-subtitle">
            Pulled to order and adjustable down to the syrup — pick a drink and set it your way.
          </p>
        </div>
        {loading ? <SkeletonGrid /> : renderGrid(drinks)}
      </section>

      <section className="feature-banner">
        <div className="shell">
          <h2 className="feature-banner__title">Check out our best coffee</h2>
          <p className="feature-banner__text">
            Every drink is built from the same fresh ingredients the kitchen counts each morning, so what you
            see on the menu is what we can actually make right now.
          </p>
          <button className="btn btn-white btn-lg" onClick={() => onBrowse()}>
            Explore the full menu
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {kitchen.length > 0 && (
        <section className="section shell">
          <div className="section-head">
            <span className="section-eyebrow">From the kitchen</span>
            <h2 className="section-title">Plates and platters</h2>
            <p className="section-subtitle">Rice bowls, snacks and sharing platters for a longer session.</p>
          </div>
          {renderGrid(kitchen)}
        </section>
      )}

      {reviews.length > 0 && (
        <section className="section shell">
          <div className="section-head">
            <span className="section-eyebrow">Come and join</span>
            <h2 className="section-title">Our happy customers</h2>
            <p className="section-subtitle">
              Left by people who ordered here, published by the team.
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
                    {review.role && <span className="review-card__role">{review.role}</span>}
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

      <section className="newsletter">
        <div className="shell">
          <h2 className="section-title">Join in and get 15% off</h2>
          <p className="section-subtitle">Subscribe for seasonal roasts, new plates and the odd discount code.</p>
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
        placeholder="Email address"
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
