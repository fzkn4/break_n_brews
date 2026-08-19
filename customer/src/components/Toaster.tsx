import { CircleAlert, CircleCheck, Info } from 'lucide-react';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
}

const ICONS = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info
} as const;

export default function Toaster({ toasts }: { toasts: ToastMessage[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <Icon size={18} className="toast__icon" />
            <span>{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
}
