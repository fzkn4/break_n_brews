import { useState } from 'react';
import { ArrowLeft, Minus, Plus, ShoppingBag, TriangleAlert, X } from 'lucide-react';
import {
  cartCount,
  cartTotal,
  formatPrice,
  productImage,
  servingsAvailable,
  summariseCustomizations
} from '../lib/catalog';
import type { StockMap } from '../lib/catalog';
import SmartImage from './SmartImage';
import { useDialogBehavior } from '../lib/useDialogBehavior';
import type { CartItem, DiningOption, MenuItem, PaymentMethod } from '../types';

export interface CheckoutDetails {
  name: string;
  dining: DiningOption;
  table: string;
  payment: PaymentMethod;
}

interface CartDrawerProps {
  cart: CartItem[];
  menuById: Map<number, MenuItem>;
  stock: StockMap;
  reserved: Map<number, number>;
  details: CheckoutDetails;
  submitting: boolean;
  error: string | null;
  onDetailsChange: (details: CheckoutDetails) => void;
  onClose: () => void;
  onQuantityChange: (lineId: string, delta: number) => void;
  onRemove: (lineId: string) => void;
  onBrowse: () => void;
  onSubmit: () => void;
}

const PAYMENTS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'e_wallet', label: 'E-wallet' }
];

export default function CartDrawer(props: CartDrawerProps) {
  const { cart, menuById, stock, reserved, details, submitting, error } = props;
  const [step, setStep] = useState<'review' | 'details'>('review');
  const [touched, setTouched] = useState(false);

  const drawerRef = useDialogBehavior<HTMLDivElement>(true, props.onClose);

  const count = cartCount(cart);
  const total = cartTotal(cart);

  const nameError = details.name.trim() ? null : 'Tell us who this order is for.';
  const tableError =
    details.dining === 'dine_in' && !details.table.trim() ? 'Which table are you at?' : null;
  const formValid = !nameError && !tableError;

  const submit = () => {
    setTouched(true);
    if (!formValid) return;
    props.onSubmit();
  };

  return (
    <>
      <div className="overlay" style={{ padding: 0 }} onMouseDown={props.onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" ref={drawerRef}>
        <div className="drawer__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step === 'details' && (
              <button className="icon-btn" onClick={() => setStep('review')} aria-label="Back to cart">
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="drawer__title" id="cart-title">
                {step === 'review' ? 'Your order' : 'Almost there'}
              </h2>
              <span className="drawer__subtitle">
                {step === 'review'
                  ? `${count} item${count === 1 ? '' : 's'}`
                  : 'A few details for the counter'}
              </span>
            </div>
          </div>
          <button className="icon-btn" onClick={props.onClose} aria-label="Close cart" data-autofocus>
            <X size={19} />
          </button>
        </div>

        <div className="drawer__body">
          {cart.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 8px' }}>
              <span className="empty-state__icon">
                <ShoppingBag size={26} />
              </span>
              <h3 className="empty-state__title">Nothing here yet</h3>
              <p className="empty-state__text">Add a drink or a plate from the menu and it will show up here.</p>
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={props.onBrowse}>
                Browse the menu
              </button>
            </div>
          ) : step === 'review' ? (
            <div>
              {cart.map((line) => {
                const item = menuById.get(line.menuItemId);
                const headroom = item ? servingsAvailable(item, stock, reserved) : Infinity;
                const canAddMore = !Number.isFinite(headroom) || headroom > 0;
                return (
                  <div className="cart-line" key={line.id}>
                    {item && <SmartImage className="cart-line__thumb" src={productImage(item)} alt="" />}
                    <div className="cart-line__main">
                      <span className="cart-line__name">{line.name}</span>
                      <span className="cart-line__meta">{summariseCustomizations(line.customizations)}</span>
                      <div className="cart-line__foot">
                        <div className="stepper stepper--sm">
                          <button
                            className="stepper__btn"
                            onClick={() => props.onQuantityChange(line.id, -1)}
                            aria-label={`Decrease ${line.name}`}
                          >
                            <Minus size={12} />
                          </button>
                          <span className="stepper__value">{line.quantity}</span>
                          <button
                            className="stepper__btn"
                            onClick={() => props.onQuantityChange(line.id, 1)}
                            disabled={!canAddMore}
                            aria-label={`Increase ${line.name}`}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 600 }}>{formatPrice(line.price * line.quantity)}</span>
                          <button
                            className="cart-line__remove"
                            onClick={() => props.onRemove(line.id)}
                            aria-label={`Remove ${line.name}`}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="checkout-steps">
              <div className="form-field">
                <label className="form-label" htmlFor="checkout-name">
                  Your name
                </label>
                <input
                  id="checkout-name"
                  className="form-input"
                  placeholder="e.g. Maria Santos"
                  value={details.name}
                  autoComplete="name"
                  onChange={(event) => props.onDetailsChange({ ...details, name: event.target.value })}
                />
                {touched && nameError && <span className="form-error">{nameError}</span>}
              </div>

              <div className="form-field">
                <span className="form-label">Where are you eating?</span>
                <div className="chip-row">
                  {(['dine_in', 'takeaway'] as DiningOption[]).map((option) => (
                    <button
                      key={option}
                      className={`chip chip--grow${details.dining === option ? ' is-active' : ''}`}
                      onClick={() => props.onDetailsChange({ ...details, dining: option })}
                    >
                      {option === 'dine_in' ? 'Dine in' : 'Takeaway'}
                    </button>
                  ))}
                </div>
              </div>

              {details.dining === 'dine_in' && (
                <div className="form-field">
                  <label className="form-label" htmlFor="checkout-table">
                    Table number
                  </label>
                  <input
                    id="checkout-table"
                    className="form-input"
                    placeholder="e.g. 5"
                    value={details.table}
                    inputMode="numeric"
                    onChange={(event) => props.onDetailsChange({ ...details, table: event.target.value })}
                  />
                  {touched && tableError && <span className="form-error">{tableError}</span>}
                </div>
              )}

              <div className="form-field">
                <span className="form-label">Paying with</span>
                <div className="chip-row">
                  {PAYMENTS.map((payment) => (
                    <button
                      key={payment.value}
                      className={`chip chip--grow${details.payment === payment.value ? ' is-active' : ''}`}
                      onClick={() => props.onDetailsChange({ ...details, payment: payment.value })}
                    >
                      {payment.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="summary-box">
                <h3 className="summary-box__title">Order summary</h3>
                {cart.map((line) => (
                  <div className="summary-row" key={line.id}>
                    <div>
                      <div className="summary-row__name">
                        {line.quantity} × {line.name}
                      </div>
                      <div className="summary-row__meta">{summariseCustomizations(line.customizations)}</div>
                    </div>
                    <span className="summary-row__price">{formatPrice(line.price * line.quantity)}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div className="callout callout--danger">
                  <TriangleAlert size={20} />
                  <div>
                    <div className="callout__title">We could not place that order</div>
                    <div className="callout__text">{error}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="drawer__foot">
            <div className="total-row">
              <span className="total-row__label">Total</span>
              <span className="total-row__value">{formatPrice(total)}</span>
            </div>
            {step === 'review' ? (
              <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep('details')}>
                Continue to checkout
              </button>
            ) : (
              <button className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={submitting}>
                {submitting ? 'Sending to the counter…' : 'Place order'}
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
