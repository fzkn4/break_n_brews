import { useEffect, useRef } from 'react';

/**
 * Shared behaviour for the product sheet and the cart drawer: close on Escape, lock the page
 * behind the overlay, move focus into the dialog and hand it back to the trigger on close.
 */
export function useDialogBehavior<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!open) return;

    const trigger = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const focusTarget =
      ref.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      ref.current?.querySelector<HTMLElement>('button, [href], input, select, textarea');
    focusTarget?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      trigger?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return ref;
}
