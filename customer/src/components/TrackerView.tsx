import { Ban, Check, ChefHat, ClipboardList, PartyPopper, Receipt, RotateCcw } from 'lucide-react';
import ReviewForm from './ReviewForm';
import type { ReviewDraft } from './ReviewForm';
import { formatPrice, parseServerTime, summariseCustomizations, titleCase } from '../lib/catalog';
import type { Order, OrderMeta, OrderStatus } from '../types';

interface TrackerViewProps {
  order: Order | null;
  meta: OrderMeta | null;
  history: Order[];
  onSelect: (orderId: number) => void;
  onBrowse: () => void;
  onReorder: (order: Order) => void;
  onStartNew: () => void;
  reviewed: boolean;
  reviewSubmitting: boolean;
  reviewError: string | null;
  onSubmitReview: (order: Order, draft: ReviewDraft) => void;
}

const STEPS: { status: OrderStatus; label: string; hint: string; Icon: typeof Check }[] = [
  { status: 'pending', label: 'Received', hint: 'At the counter', Icon: ClipboardList },
  { status: 'preparing', label: 'Preparing', hint: 'On the bar', Icon: ChefHat },
  { status: 'completed', label: 'Ready', hint: 'Come collect', Icon: PartyPopper }
];

const STEP_INDEX: Record<OrderStatus, number> = {
  pending: 0,
  preparing: 1,
  completed: 2,
  cancelled: 0
};

function elapsedLabel(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - parseServerTime(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? '' : 's'} ago`;
}

function timeLabel(iso: string): string {
  return parseServerTime(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TrackerView({
  order,
  meta,
  history,
  onSelect,
  onBrowse,
  onReorder,
  onStartNew,
  reviewed,
  reviewSubmitting,
  reviewError,
  onSubmitReview
}: TrackerViewProps) {
  if (!order) {
    return (
      <section className="section shell">
        <div className="empty-state">
          <span className="empty-state__icon">
            <Receipt size={26} />
          </span>
          <h1 className="empty-state__title">No orders yet</h1>
          <p className="empty-state__text">
            Once you place an order it appears here, and you can watch it move from the counter to the bar in
            real time.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onBrowse}>
            Browse the menu
          </button>
        </div>
      </section>
    );
  }

  const cancelled = order.status === 'cancelled';
  const currentStep = STEP_INDEX[order.status];
  const progress = cancelled ? 0 : currentStep === 0 ? 0 : currentStep === 1 ? 50 : 100;

  return (
    <section className="section shell">
      <div className="tracker">
        <div className="section-head" style={{ marginBottom: 26 }}>
          <span className="section-eyebrow">Live status</span>
          <h1 className="section-title">Your order</h1>
        </div>

        <div className="tracker-card">
          <div className="tracker-card__head">
            <div>
              <h2 className="tracker-card__id">Order #{order.id}</h2>
              <p className="tracker-card__meta">
                Placed {timeLabel(order.created_at)} · {elapsedLabel(order.created_at)}
              </p>
            </div>
            <span className={`status-badge status-badge--${order.status}`}>{order.status}</span>
          </div>

          {cancelled ? (
            <div className="callout callout--danger">
              <Ban size={22} />
              <div>
                <div className="callout__title">This order was cancelled</div>
                <div className="callout__text">
                  Talk to the counter if that was not expected — nothing was charged through the app.
                </div>
              </div>
            </div>
          ) : (
            <div className="timeline">
              <div className="timeline__track">
                <div className="timeline__fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="timeline__steps">
                {STEPS.map((step, index) => {
                  const done = index < currentStep;
                  const current = index === currentStep;
                  const isFinal = index === 2 && order.status === 'completed';
                  const classes = [
                    'timeline__step',
                    done ? 'is-done' : '',
                    current ? 'is-current' : '',
                    isFinal ? 'is-final' : ''
                  ]
                    .filter(Boolean)
                    .join(' ');
                  const Icon = done ? Check : step.Icon;
                  return (
                    <div className={classes} key={step.status}>
                      <span className="timeline__dot">
                        <Icon size={18} />
                      </span>
                      <span className="timeline__label">{step.label}</span>
                      <span className="timeline__hint">{step.hint}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {order.status === 'completed' && (
            <div className="callout callout--success">
              <PartyPopper size={22} />
              <div>
                <div className="callout__title">Ready for pickup</div>
                <div className="callout__text">
                  {meta?.dining === 'dine_in' && meta.table
                    ? `We are bringing it to table ${meta.table}. Enjoy your brew!`
                    : 'Collect it at the counter. Enjoy your brew!'}
                </div>
              </div>
            </div>
          )}

          {order.status === 'preparing' && (
            <div className="callout callout--info">
              <ChefHat size={22} />
              <div>
                <div className="callout__title">The bar is on it</div>
                <div className="callout__text">This page updates by itself — no need to refresh.</div>
              </div>
            </div>
          )}

          {meta && (
            <div className="detail-grid">
              <div>
                <div className="detail-grid__label">Name</div>
                <div className="detail-grid__value">{meta.name}</div>
              </div>
              <div>
                <div className="detail-grid__label">Serving</div>
                <div className="detail-grid__value">
                  {meta.dining === 'dine_in' ? `Dine in · Table ${meta.table || '—'}` : 'Takeaway'}
                </div>
              </div>
              <div>
                <div className="detail-grid__label">Payment</div>
                <div className="detail-grid__value">{titleCase(meta.payment.replace('_', ' '))}</div>
              </div>
            </div>
          )}

          <div className="summary-box">
            <h3 className="summary-box__title">Items ordered</h3>
            {order.items.map((item) => (
              <div className="summary-row" key={item.id}>
                <div>
                  <div className="summary-row__name">
                    {item.quantity} × {item.menu_item_name ?? 'Item'}
                  </div>
                  <div className="summary-row__meta">{summariseCustomizations(item.customizations)}</div>
                </div>
                <span className="summary-row__price">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
            <div className="summary-total">
              <span>Total</span>
              <span className="summary-total__value">{formatPrice(order.total_amount)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onReorder(order)}>
              <RotateCcw size={16} />
              Order this again
            </button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={onStartNew}>
              Start a new order
            </button>
          </div>
        </div>

        {order.status === 'completed' &&
          (reviewed ? (
            <div className="callout callout--success" style={{ marginTop: 20 }}>
              <Check size={22} />
              <div>
                <div className="callout__title">Thanks for the review</div>
                <div className="callout__text">
                  It appears on the home page once the team has had a look at it.
                </div>
              </div>
            </div>
          ) : (
            <ReviewForm
              defaultName={meta?.name ?? ''}
              submitting={reviewSubmitting}
              error={reviewError}
              onSubmit={(draft) => onSubmitReview(order, draft)}
            />
          ))}

        {history.length > 1 && (
          <div style={{ marginTop: 34 }}>
            <h2 className="summary-box__title" style={{ fontSize: '0.78rem' }}>
              Earlier orders
            </h2>
            <div className="history-list">
              {history.map((past) => (
                <button
                  key={past.id}
                  className={`history-row${past.id === order.id ? ' is-active' : ''}`}
                  onClick={() => onSelect(past.id)}
                >
                  <span className={`status-badge status-badge--${past.status}`}>{past.status}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>Order #{past.id}</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {past.items.length} item{past.items.length === 1 ? '' : 's'} ·{' '}
                      {parseServerTime(past.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{formatPrice(past.total_amount)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
