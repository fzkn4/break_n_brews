import React, { useState } from 'react';
import { Check, EyeOff, Filter, Mail, MessageSquare, Star, Trash2 } from 'lucide-react';
import type { Review, Subscriber } from '../types';

interface ManageReviewsProps {
  reviews: Review[];
  subscribers: Subscriber[];
  onPublishReview: (id: number, isPublished: boolean) => void;
  onDeleteReview: (id: number) => void;
}

type Filter = 'pending' | 'published' | 'all';

export const ManageReviews: React.FC<ManageReviewsProps> = ({
  reviews,
  subscribers,
  onPublishReview,
  onDeleteReview
}) => {
  // Pending first: an unapproved review is the only thing on this screen that needs a decision.
  const [filter, setFilter] = useState<Filter>('pending');

  const pendingCount = reviews.filter(r => !r.is_published).length;
  const visible = reviews.filter(r =>
    filter === 'all' ? true : filter === 'pending' ? !r.is_published : r.is_published
  );

  const averageRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <p style={styles.subtitle}>
          Customer reviews appear on the storefront only once you publish them.
        </p>

        <div style={styles.filterGroup}>
          <Filter size={16} color="#9ca3af" />
          <select
            className="glass-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            style={{ paddingRight: '24px' }}
          >
            <option value="pending">Awaiting approval ({pendingCount})</option>
            <option value="published">Published</option>
            <option value="all">All reviews ({reviews.length})</option>
          </select>
        </div>
      </div>

      <div style={styles.statRow}>
        <div className="glass-card" style={styles.statCard}>
          <MessageSquare size={18} color="var(--accent-primary)" />
          <div>
            <span style={styles.statValue}>{reviews.length}</span>
            <span style={styles.statLabel}>Total reviews</span>
          </div>
        </div>
        <div className="glass-card" style={styles.statCard}>
          <Star size={18} color="#f59e0b" />
          <div>
            <span style={styles.statValue}>{averageRating}</span>
            <span style={styles.statLabel}>Average rating</span>
          </div>
        </div>
        <div className="glass-card" style={styles.statCard}>
          <Mail size={18} color="var(--accent-primary)" />
          <div>
            <span style={styles.statValue}>{subscribers.length}</span>
            <span style={styles.statLabel}>Newsletter signups</span>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="glass-card" style={styles.empty}>
          <MessageSquare size={28} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
            {filter === 'pending' ? 'Nothing waiting for approval' : 'No reviews here yet'}
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Reviews arrive from the customer portal after an order is completed.
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {visible.map(review => (
            <div key={review.id} className="glass-card" style={styles.card}>
              <div style={styles.cardHead}>
                <div>
                  <h4 style={styles.name}>
                    {review.customer_name}
                    {review.role && <span style={styles.role}> · {review.role}</span>}
                  </h4>
                  <span style={styles.meta}>
                    {new Date(review.created_at + 'Z').toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                    {review.order_id ? ` · from order #${review.order_id}` : ' · not tied to an order'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        size={14}
                        fill={star <= review.rating ? '#f59e0b' : 'none'}
                        color={star <= review.rating ? '#f59e0b' : 'var(--border-glass)'}
                      />
                    ))}
                  </div>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: review.is_published ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.14)',
                      color: review.is_published ? '#10b981' : '#f59e0b'
                    }}
                  >
                    {review.is_published ? 'Published' : 'Pending'}
                  </span>
                </div>
              </div>

              <p style={styles.comment}>“{review.comment}”</p>

              <div style={styles.actions}>
                <button
                  onClick={() => onPublishReview(review.id, !review.is_published)}
                  className={`btn ${review.is_published ? 'btn-secondary' : 'btn-primary'}`}
                  style={styles.actionBtn}
                >
                  {review.is_published ? <EyeOff size={15} /> : <Check size={15} />}
                  {review.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={() => onDeleteReview(review.id)}
                  className="btn btn-danger"
                  style={styles.actionBtn}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card" style={styles.subscriberBox}>
        <h3 style={styles.subTitle}>
          <Mail size={16} /> Newsletter subscribers ({subscribers.length})
        </h3>
        {subscribers.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            No signups yet.
          </p>
        ) : (
          <div style={styles.chipWrap}>
            {subscribers.map(sub => (
              <span key={sub.id} style={styles.emailChip}>
                {sub.email}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    boxSizing: 'border-box' as const,
    overflowY: 'auto' as const,
    flex: 1
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
    gap: '16px'
  },
  subtitle: {
    margin: 0,
    fontSize: '0.88rem',
    color: 'var(--text-secondary)'
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '14px'
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 18px'
  },
  statValue: {
    display: 'block',
    fontSize: '1.35rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: 1.1
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em'
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px'
  },
  card: {
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  },
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
    gap: '12px'
  },
  name: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  role: {
    fontWeight: '400',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem'
  },
  meta: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)'
  },
  statusBadge: {
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: '700',
    letterSpacing: '0.04em'
  },
  comment: {
    margin: 0,
    fontSize: '0.92rem',
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    fontStyle: 'italic' as const
  },
  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.85rem',
    padding: '8px 14px'
  },
  empty: {
    padding: '48px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    textAlign: 'center' as const
  },
  subscriberBox: {
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  },
  subTitle: {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.95rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  chipWrap: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px'
  },
  emailChip: {
    padding: '5px 12px',
    borderRadius: '999px',
    backgroundColor: 'var(--accent-light, rgba(148,118,86,0.12))',
    border: '1px solid var(--border-glass)',
    fontSize: '0.82rem',
    color: 'var(--text-primary)'
  }
};
