import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  size?: number;
  /** Omit to render a static rating. */
  onChange?: (rating: number) => void;
}

export default function StarRating({ value, size = 15, onChange }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <div className="star-row" aria-label={`${value} out of 5`}>
        {stars.map((star) => (
          <Star
            key={star}
            size={size}
            fill={star <= value ? 'var(--gold)' : 'none'}
            color={star <= value ? 'var(--gold)' : 'var(--border-strong)'}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="star-row" role="radiogroup" aria-label="Rating">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          className="star-btn"
          onClick={() => onChange(star)}
        >
          <Star
            size={size}
            fill={star <= value ? 'var(--gold)' : 'none'}
            color={star <= value ? 'var(--gold)' : 'var(--border-strong)'}
          />
        </button>
      ))}
    </div>
  );
}
