import { useState } from 'react';
import { BellRing, Check, Loader2, X } from 'lucide-react';

export type SubscribeStatus = 'subscribed' | 'already' | 'resubscribed';

interface MenuUpdatesPromptProps {
  /** Set once this device has signed up, so the card shows its thank-you state. */
  confirmedEmail: string | null;
  confirmedStatus: SubscribeStatus | null;
  onSubscribe: (email: string) => Promise<SubscribeStatus | null>;
  onDismiss: () => void;
  onUseDifferentEmail: () => void;
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const CONFIRMATION: Record<SubscribeStatus, string> = {
  subscribed: "You're on the list!",
  already: "You're already on the list",
  resubscribed: 'Welcome back to the list!'
};

/**
 * Shown on the order tracker right after checkout, while the guest waits for their order.
 * It sits under the order instead of popping over it, and "No thanks" hides it on this device.
 */
export default function MenuUpdatesPrompt({
  confirmedEmail,
  confirmedStatus,
  onSubscribe,
  onDismiss,
  onUseDifferentEmail
}: MenuUpdatesPromptProps) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);

  if (confirmedEmail) {
    return (
      <div className="updates-card updates-card--done" role="status">
        <span className="updates-card__icon updates-card__icon--done">
          <Check size={20} />
        </span>
        <div className="updates-card__copy">
          <div className="updates-card__title">{CONFIRMATION[confirmedStatus ?? 'subscribed']}</div>
          <p className="updates-card__text">
            We'll email <b>{confirmedEmail}</b> when something new lands on the menu. Every email has a one-click
            unsubscribe link.
          </p>
          <button type="button" className="updates-card__link" onClick={onUseDifferentEmail}>
            Not your email? Use a different one
          </button>
        </div>
      </div>
    );
  }

  const value = email.trim();
  const error = !value ? 'Enter your email address.' : EMAIL_RE.test(value) ? null : 'That email does not look quite right.';
  const showError = touched && error;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (error) return;
    setSending(true);
    await onSubscribe(value.toLowerCase());
    setSending(false);
  };

  return (
    <form className="updates-card" onSubmit={submit} noValidate aria-labelledby="updates-title">
      <span className="updates-card__icon">
        <BellRing size={20} />
      </span>
      <div className="updates-card__copy">
        <div className="updates-card__title" id="updates-title">
          Want to hear about our new menu?
        </div>
        <p className="updates-card__text">
          Leave your email and we'll let you know when something new is on the menu. Only new items, no spam.
        </p>

        <div className="updates-card__row">
          <label className="sr-only" htmlFor="updates-email">
            Email address
          </label>
          <input
            id="updates-email"
            className="form-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => value && setTouched(true)}
            aria-invalid={Boolean(showError)}
            aria-describedby={showError ? 'updates-error' : undefined}
            disabled={sending}
          />
          <button className="btn btn-primary" type="submit" disabled={sending}>
            {sending ? <Loader2 size={16} className="spin" /> : <BellRing size={16} />}
            {sending ? 'Saving…' : 'Keep me updated'}
          </button>
        </div>
        {showError && (
          <span className="form-error" id="updates-error">
            {error}
          </span>
        )}
      </div>

      <button type="button" className="updates-card__dismiss" onClick={onDismiss} aria-label="No thanks, hide this">
        <X size={18} />
        <span>No thanks</span>
      </button>
    </form>
  );
}
