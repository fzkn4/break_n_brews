import { useState } from 'react';
import { MessageSquareHeart, Send } from 'lucide-react';
import StarRating from './StarRating';

export interface ReviewDraft {
  customer_name: string;
  role: string;
  rating: number;
  comment: string;
}

interface ReviewFormProps {
  defaultName: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (draft: ReviewDraft) => void;
}

export default function ReviewForm({ defaultName, submitting, error, onSubmit }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState('');
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError = name.trim() ? null : 'Add the name you want shown.';
  const commentError = comment.trim().length >= 10 ? null : 'Tell us a little more — at least 10 characters.';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (nameError || commentError) return;
    onSubmit({ customer_name: name.trim(), role: role.trim(), rating, comment: comment.trim() });
  };

  return (
    <form className="review-form" onSubmit={submit}>
      <div className="review-form__head">
        <MessageSquareHeart size={22} />
        <div>
          <h3 className="callout__title">How was it?</h3>
          <p className="callout__text">
            Your note goes to the team and shows up on the home page once they approve it.
          </p>
        </div>
      </div>

      <div className="form-field">
        <span className="form-label">Your rating</span>
        <StarRating value={rating} size={26} onChange={setRating} />
      </div>

      <div className="review-form__row">
        <div className="form-field">
          <label className="form-label" htmlFor="review-name">
            Name
          </label>
          <input
            id="review-name"
            className="form-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Maria Santos"
          />
          {touched && nameError && <span className="form-error">{nameError}</span>}
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="review-role">
            Tagline <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="review-role"
            className="form-input"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="e.g. Weekend regular"
          />
        </div>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="review-comment">
          Your review
        </label>
        <textarea
          id="review-comment"
          className="form-input"
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What did you order, and how was it?"
        />
        {touched && commentError && <span className="form-error">{commentError}</span>}
      </div>

      {error && <span className="form-error">{error}</span>}

      <button className="btn btn-primary" type="submit" disabled={submitting}>
        <Send size={16} />
        {submitting ? 'Sending…' : 'Send review'}
      </button>
    </form>
  );
}
