import { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, TriangleAlert, X } from 'lucide-react';
import {
  CUSTOMIZATION_LEVELS,
  describeItem,
  formatPrice,
  productImage,
  servingsAvailable,
  titleCase
} from '../lib/catalog';
import type { StockMap } from '../lib/catalog';
import SmartImage from './SmartImage';
import { useDialogBehavior } from '../lib/useDialogBehavior';
import type { CustomizationLevel, MenuItem } from '../types';

interface ProductSheetProps {
  item: MenuItem;
  stock: StockMap;
  reserved: Map<number, number>;
  onClose: () => void;
  onAdd: (item: MenuItem, levels: Record<number, CustomizationLevel>, quantity: number) => void;
}

const LEVEL_HINT: Record<CustomizationLevel, string> = {
  None: 'leave it out',
  Less: 'half the usual',
  Regular: 'as the recipe',
  Extra: 'half again more'
};

export default function ProductSheet({ item, stock, reserved, onClose, onAdd }: ProductSheetProps) {
  const customizable = useMemo(() => item.ingredients.filter((ing) => ing.is_customizable), [item]);

  const [levels, setLevels] = useState<Record<number, CustomizationLevel>>(() =>
    Object.fromEntries(customizable.map((ing) => [ing.ingredient_id, 'Regular' as CustomizationLevel]))
  );
  const [quantity, setQuantity] = useState(1);

  const dialogRef = useDialogBehavior<HTMLDivElement>(true, onClose);

  /** Recomputed per level change: "Extra" on a scarce syrup really does cut how many we can make. */
  const maxQuantity = useMemo(() => {
    const available = servingsAvailable(item, stock, reserved, levels);
    return Number.isFinite(available) ? Math.max(0, available) : 99;
  }, [item, stock, reserved, levels]);

  const effectiveQty = Math.min(quantity, Math.max(1, maxQuantity));
  const isCustomised = customizable.some((ing) => levels[ing.ingredient_id] !== 'Regular');

  const setLevel = (ingredientId: number, level: CustomizationLevel) => {
    setLevels((prev) => ({ ...prev, [ingredientId]: level }));
  };

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-sheet-title"
        ref={dialogRef}
      >
        <div className="dialog__media">
          <SmartImage src={productImage(item)} alt={item.name} />
          <button className="dialog__close" onClick={onClose} aria-label="Close" data-autofocus>
            <X size={19} />
          </button>
        </div>

        <div className="dialog__body">
          <div>
            <span className="product-card__category">{titleCase(item.category)}</span>
            <h2 id="product-sheet-title" style={{ fontSize: '1.55rem', marginTop: 4 }}>
              {item.name}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 6 }}>{describeItem(item)}</p>
          </div>

          {maxQuantity > 0 && maxQuantity <= 5 && (
            <div className="callout callout--warning">
              <TriangleAlert size={20} />
              <div>
                <div className="callout__title">Almost gone</div>
                <div className="callout__text">
                  We can make {maxQuantity} more of this right now, with your cart taken into account.
                </div>
              </div>
            </div>
          )}

          {maxQuantity === 0 && (
            <div className="callout callout--danger">
              <TriangleAlert size={20} />
              <div>
                <div className="callout__title">Out of stock at these settings</div>
                <div className="callout__text">Try a lighter option below, or pick something else.</div>
              </div>
            </div>
          )}

          {customizable.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="row-between">
                <span className="option-group__label" style={{ margin: 0 }}>
                  Make it yours
                </span>
                {isCustomised && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setLevels(
                        Object.fromEntries(
                          customizable.map((ing) => [ing.ingredient_id, 'Regular' as CustomizationLevel])
                        )
                      )
                    }
                  >
                    Reset
                  </button>
                )}
              </div>

              {customizable.map((ing) => {
                const current = levels[ing.ingredient_id] ?? 'Regular';
                return (
                  <div className="option-group" key={ing.ingredient_id}>
                    <span className="option-group__label">
                      {ing.name}
                      <span className="option-group__hint">{LEVEL_HINT[current]}</span>
                    </span>
                    <div className="chip-row" role="radiogroup" aria-label={ing.name}>
                      {CUSTOMIZATION_LEVELS.map((level) => (
                        <button
                          key={level}
                          role="radio"
                          aria-checked={current === level}
                          className={`chip chip--grow${current === level ? ' is-active' : ''}`}
                          onClick={() => setLevel(ing.ingredient_id, level)}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Customising changes what goes in the cup, not the price.
              </p>
            </div>
          )}

          <div className="row-between">
            <span className="option-group__label">Quantity</span>
            <div className="stepper">
              <button
                className="stepper__btn"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={effectiveQty <= 1}
                aria-label="Decrease quantity"
              >
                <Minus size={15} />
              </button>
              <span className="stepper__value" aria-live="polite">
                {effectiveQty}
              </span>
              <button
                className="stepper__btn"
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                disabled={effectiveQty >= maxQuantity}
                aria-label="Increase quantity"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="dialog__foot">
          <button
            className="btn btn-primary btn-lg btn-block"
            disabled={maxQuantity === 0}
            onClick={() => onAdd(item, levels, effectiveQty)}
          >
            <ShoppingBag size={18} />
            Add to order · {formatPrice(item.price * effectiveQty)}
          </button>
        </div>
      </div>
    </div>
  );
}
