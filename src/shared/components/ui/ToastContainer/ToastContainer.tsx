import React, { useEffect } from 'react';
import { useNotificationsStore } from '../../../stores/notificationsStore';
import type { Toast } from '../../../stores/notificationsStore';

const ICONS: Record<string, string> = {
  success: '✓',
  warning: '⚠️',
  error: '✕',
  info: 'ℹ',
};

const COLORS: Record<string, string> = {
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#60A5FA',
};

const DEFAULT_DURATION = 4000;

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useNotificationsStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, toast.duration ?? DEFAULT_DURATION);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <div
      className="fos-toast"
      style={{ '--toast-color': COLORS[toast.type] } as React.CSSProperties}
      role="alert"
      aria-live="polite"
    >
      <span className="fos-toast__icon">{ICONS[toast.type]}</span>
      <span className="fos-toast__message">{toast.message}</span>
      <button
        className="fos-toast__close"
        onClick={() => removeToast(toast.id)}
        aria-label="Fermer"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useNotificationsStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <>
      <div className="fos-toast-container">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
      <style>{TOAST_STYLES}</style>
    </>
  );
}

const TOAST_STYLES = `
.fos-toast-container {
  position: fixed;
  top: max(env(safe-area-inset-top, 0px) + 12px, 20px);
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(360px, calc(100vw - 32px));
  pointer-events: none;
}

.fos-toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.12),
    0 1px 4px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  pointer-events: all;
  animation: toastIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes toastIn {
  from { opacity: 0; transform: translateX(20px) scale(0.95); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}

.fos-toast__icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--toast-color) 15%, transparent);
  color: var(--toast-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.fos-toast__message {
  flex: 1;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  font-size: 13.5px;
  font-weight: 500;
  color: #1a1a2e;
  line-height: 1.4;
}

.fos-toast__close {
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
  flex-shrink: 0;
  transition: color 0.15s;
}

.fos-toast__close:hover { color: #4b5563; }

@media (max-width: 480px) {
  .fos-toast-container {
    top: auto;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
    left: 16px;
    right: 16px;
    max-width: none;
  }
}
`;
