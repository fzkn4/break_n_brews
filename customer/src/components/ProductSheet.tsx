import { useMemo, useState } from 'react';
import { Coffee, Minus, Plus, RotateCcw, ShoppingBag, TriangleAlert, X } from 'lucide-react';
import {
  CUSTOMIZATION_LEVELS,
  LEVEL_MULTIPLIER,
  defaultProductSize,
  describeItem,
  formatPrice,
  formatRecipeAmount,
  getItemPrice,
  offeredSizesOf,
  productImage,
  recipeQtyForSize,
  servingsAvailable,
  summariseOrderLine,
  titleCase
} from '../lib/catalog';
import type { StockMap } from '../lib/catalog';
import SmartImage from './SmartImage';
import { useDialogBehavior } from '../lib/useDialogBehavior';
import type { CustomizationLevel, MenuItem, ProductSize, RecipeIngredient } from '../types';

interface ProductSheetProps {
  item: MenuItem;
  stock: StockMap;
  reserved: Map<number, number>;
  onClose: () => void;
  onAdd: (
    item: MenuItem,
    levels: Record<number, CustomizationLevel>,
    quantity: number,
    size?: ProductSize
  ) => void;
}

const LEVEL_LABEL: Record<CustomizationLevel, string> = {
  None: 'None',
  Less: 'Less',
  Regular: 'Regular',
  Extra: 'Extra'
};

/** Cup icon scale per size, so the size cards read at a glance. */
const SIZE_ICON: Record<ProductSize, number> = { Small: 18, Regular: 22, Large: 27 };

/** Cups, straws and lids are not worth listing as "always included". */
const PACKAGING = /cup|straw|packag|lid|napkin/i;

const allRegular = (recipe: RecipeIngredient[]) =>
  Object.fromEntries(recipe.map((ing) => [ing.ingredient_id, 'Regular' as CustomizationLevel]));

export default function ProductSheet({ item, stock, reserved, onClose, onAdd }: ProductSheetProps) {
  const customizable = useMemo(() => item.ingredients.filter((ing) => ing.is_customizable), [item]);
  const fixed = useMemo(
    () => item.ingredients.filter((ing) => !ing.is_customizable && !PACKAGING.test(ing.name)),
    [item]
  );
  const offeredSizes = offeredSizesOf(item);
  const hasSizes = offeredSizes.length > 0;

  const [size, setSize] = useState<ProductSize>(defaultProductSize(item) ?? 'Regular');
  const [levels, setLevels] = useState<Record<number, CustomizationLevel>>(() => allRegular(customizable));
  const [quantity, setQuantity] = useState(1);

  const dialogRef = useDialogBehavior<HTMLDivElement>(true, onClose);

  /** Recomputed per level change: "Extra" on a scarce syrup really does cut how many we can make. */
  const maxQuantity = useMemo(() => {
    const available = servingsAvailable(item, stock, reserved, levels, size);
    return Number.isFinite(available) ? Math.max(0, available) : 99;
  }, [item, stock, reserved, levels, size]);

  const effectiveQty = Math.min(quantity, Math.max(1, maxQuantity));
  const isCustomised = customizable.some((ing) => levels[ing.ingredient_id] !== 'Regular');
  const chosenSize = hasSizes ? size : undefined;

  const setLevel = (ingredientId: number, level: CustomizationLevel) => {
    setLevels((prev) => ({ ...prev, [ingredientId]: level }));
  };

  /** A level is offered only if at least one serving at the chosen size could still be made with it. */
  const levelFits = (ingredientId: number, level: CustomizationLevel): boolean =>
    servingsAvailable(item, stock, reserved, { ...levels, [ingredientId]: level }, size) > 0;

  const amountFor = (recipe: RecipeIngredient, level: CustomizationLevel): string =>
    level === 'None' ? '—' : formatRecipeAmount(recipeQtyForSize(recipe, size) * LEVEL_MULTIPLIER[level], recipe.unit);

  const summary = summariseOrderLine(
    chosenSize ?? null,
    customizable.map((ing) => ({ name: ing.name, level: levels[ing.ingredient_id] ?? 'Regular' }))
  );

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
            <h2 id="product-sheet-title" className="dialog__title">
              {item.name}
            </h2>
            <p className="dialog__lede">{describeItem(item)}</p>
          </div>

          {hasSizes && (
            <div className="option-group">
              <span className="option-group__label">
                Size
                <span className="option-group__hint">You can customise any size</span>
              </span>
              <div className="size-grid" role="radiogroup" aria-label="Size">
                {offeredSizes.map((option) => (
                  <button
                    key={option}
                    role="radio"
                    aria-checked={size === option}
                    className={`size-card${size === option ? ' is-active' : ''}`}
                    onClick={() => setSize(option)}
                  >
                    <span className="size-card__icon">
                      <Coffee size={SIZE_ICON[option]} />
                    </span>
                    <span className="size-card__name">{option}</span>
                    <span className="size-card__price">{formatPrice(getItemPrice(item, option))}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
                <div className="callout__text">Try a smaller size or a lighter option below, or pick something else.</div>
              </div>
            </div>
          )}

          {customizable.length > 0 && (
            <section className="customizer" aria-labelledby="customizer-title">
              <div className="customizer__head">
                <div>
                  <h3 id="customizer-title" className="customizer__title">
                    {hasSizes ? `Customise your ${size}` : 'Make it yours'}
                  </h3>
                  <p className="customizer__sub">
                    {hasSizes
                      ? `Amounts are for a ${size.toLowerCase()} and update when you change size.`
                      : 'Adjust how much of each goes in.'}
                  </p>
                </div>
                {isCustomised && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setLevels(allRegular(customizable))}>
                    <RotateCcw size={14} />
                    Reset
                  </button>
                )}
              </div>

              {customizable.map((ing) => {
                const current = levels[ing.ingredient_id] ?? 'Regular';
                const step = CUSTOMIZATION_LEVELS.indexOf(current);
                return (
                  <div className={`ingredient-row${current !== 'Regular' ? ' is-changed' : ''}`} key={ing.ingredient_id}>
                    <div className="ingredient-row__head">
                      <span className="ingredient-row__name">{ing.name}</span>
                      {/* keyed on size so the amount visibly refreshes when the cup changes */}
                      <span className="ingredient-row__amount" key={`${size}-${current}`}>
                        {current === 'None' ? 'Left out' : amountFor(ing, current)}
                      </span>
                    </div>
                    <div className="level-meter" aria-hidden="true">
                      <span className="level-meter__fill" style={{ width: `${(step / (CUSTOMIZATION_LEVELS.length - 1)) * 100}%` }} />
                    </div>
                    <div className="level-seg" role="radiogroup" aria-label={`${ing.name} amount`}>
                      {CUSTOMIZATION_LEVELS.map((level) => {
                        const fits = level === current || levelFits(ing.ingredient_id, level);
                        return (
                          <button
                            key={level}
                            role="radio"
                            aria-checked={current === level}
                            className={`level-seg__btn${current === level ? ' is-active' : ''}`}
                            onClick={() => setLevel(ing.ingredient_id, level)}
                            disabled={!fits}
                            title={fits ? undefined : 'Not enough in stock for this'}
                          >
                            <span className="level-seg__label">{LEVEL_LABEL[level]}</span>
                            <span className="level-seg__amount">{amountFor(ing, level)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {fixed.length > 0 && (
                <div className="customizer__fixed">
                  <span className="customizer__fixed-label">Always included</span>
                  <div className="customizer__fixed-list">
                    {fixed.map((ing) => (
                      <span className="tag" key={ing.ingredient_id}>
                        {ing.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="customizer__note">Customising changes what goes in the cup, not the price.</p>
            </section>
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
          {(hasSizes || customizable.length > 0) && (
            <p className="dialog__summary" aria-live="polite">
              {summary}
            </p>
          )}
          <button
            className="btn btn-primary btn-lg btn-block"
            disabled={maxQuantity === 0}
            onClick={() => onAdd(item, levels, effectiveQty, chosenSize)}
          >
            <ShoppingBag size={18} />
            Add to order · {formatPrice(getItemPrice(item, chosenSize) * effectiveQty)}
          </button>
        </div>
      </div>
    </div>
  );
}
