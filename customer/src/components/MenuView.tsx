import { Heart, Search, SearchX, X } from 'lucide-react';
import CategoryRail from './CategoryRail';
import ProductCard from './ProductCard';
import { SkeletonGrid } from './HomeView';
import { categoriesFrom } from '../lib/catalog';
import type { Availability } from '../lib/catalog';
import type { MenuItem } from '../types';

interface MenuViewProps {
  menuItems: MenuItem[];
  loading: boolean;
  category: string;
  search: string;
  favorites: number[];
  onlyFavorites: boolean;
  availabilityFor: (item: MenuItem) => Availability;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onToggleOnlyFavorites: () => void;
  onOpen: (item: MenuItem) => void;
  onToggleFavorite: (id: number) => void;
}

export default function MenuView(props: MenuViewProps) {
  const { menuItems, loading, category, search, favorites, onlyFavorites } = props;

  const categories = categoriesFrom(menuItems);

  const counts = new Map<string, number>();
  for (const item of menuItems) {
    const key = item.category.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  counts.set('all', menuItems.length);

  const query = search.trim().toLowerCase();
  const visible = menuItems.filter((item) => {
    if (category !== 'All' && item.category.toLowerCase() !== category.toLowerCase()) return false;
    if (onlyFavorites && !favorites.includes(item.id)) return false;
    if (!query) return true;
    return item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
  });

  const filtered = category !== 'All' || onlyFavorites || query.length > 0;

  const clearAll = () => {
    props.onCategoryChange('All');
    props.onSearchChange('');
    if (onlyFavorites) props.onToggleOnlyFavorites();
  };

  return (
    <>
      <div className="shell">
        <div className="menu-head">
          <div>
            <h1 className="menu-head__title">Order menu</h1>
            <p className="menu-head__subtitle">
              Everything here is in stock right now — availability updates as the kitchen works.
            </p>
          </div>

          <div className="search-field">
            <Search size={18} color="var(--text-muted)" />
            <label className="visually-hidden" htmlFor="menu-search">
              Search the menu
            </label>
            <input
              id="menu-search"
              type="search"
              placeholder="Search drinks, snacks, meals…"
              value={search}
              onChange={(event) => props.onSearchChange(event.target.value)}
            />
            {search && (
              <button onClick={() => props.onSearchChange('')} aria-label="Clear search">
                <X size={16} color="var(--text-muted)" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="category-band">
        <div className="shell">
          <CategoryRail
            categories={categories}
            selected={category}
            counts={counts}
            onSelect={props.onCategoryChange}
          />
        </div>
      </div>

      <section className="section shell" style={{ paddingBlock: 'clamp(24px, 4vw, 40px)' }}>
        <div className="result-line">
          <span>
            {loading ? 'Loading the menu…' : `${visible.length} item${visible.length === 1 ? '' : 's'}`}
          </span>
          <button
            className={`chip${onlyFavorites ? ' is-active' : ''}`}
            onClick={props.onToggleOnlyFavorites}
            aria-pressed={onlyFavorites}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Heart size={14} fill={onlyFavorites ? 'currentColor' : 'none'} />
            Favourites {favorites.length > 0 && `(${favorites.length})`}
          </button>
          {filtered && (
            <button className="btn btn-ghost btn-sm" onClick={clearAll}>
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <SkeletonGrid count={8} />
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon">
              <SearchX size={26} />
            </span>
            <h2 className="empty-state__title">Nothing matches that</h2>
            <p className="empty-state__text">
              {onlyFavorites && favorites.length === 0
                ? 'Tap the heart on anything you like and it will collect here.'
                : 'Try a different category, or clear the filters to see the whole menu.'}
            </p>
            {filtered && (
              <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={clearAll}>
                Show everything
              </button>
            )}
          </div>
        ) : (
          <div className="product-grid">
            {visible.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                availability={props.availabilityFor(item)}
                isFavorite={favorites.includes(item.id)}
                onOpen={props.onOpen}
                onToggleFavorite={props.onToggleFavorite}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
