import { categoryIcon } from '../lib/catalog';

interface CategoryRailProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
  counts?: Map<string, number>;
  /** `tabs` filters the list in place; `links` jumps to the menu view. */
  variant?: 'tabs' | 'links';
}

export default function CategoryRail({
  categories,
  selected,
  onSelect,
  counts,
  variant = 'tabs'
}: CategoryRailProps) {
  const asTabs = variant === 'tabs';
  return (
    <div
      className="category-rail category-rail--centered"
      role={asTabs ? 'tablist' : undefined}
      aria-label="Menu categories"
    >
      {categories.map((category) => {
        const Icon = categoryIcon(category);
        const isActive = asTabs && category.toLowerCase() === selected.toLowerCase();
        const count = counts?.get(category.toLowerCase());
        return (
          <button
            key={category}
            role={asTabs ? 'tab' : undefined}
            aria-selected={asTabs ? isActive : undefined}
            className={`category-tab${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(category)}
          >
            <span className="category-tab__icon">
              <Icon size={20} />
            </span>
            <span>
              {category}
              {count !== undefined && ` (${count})`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
