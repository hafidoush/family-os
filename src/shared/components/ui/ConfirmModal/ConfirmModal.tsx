import { Modal } from '../Modal/Modal';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onCancel} variant="alert" size="sm" persistent>
      <Modal.Body>
        <p style={{
          fontWeight: 600,
          fontSize: '1rem',
          color: 'var(--color-text)',
          marginBottom: message ? '8px' : 0,
          lineHeight: 1.4,
        }}>
          {title}
        </p>
        {message && (
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--color-muted)',
            lineHeight: 1.5,
          }}>
            {message}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer align="stretch">
        <button
          onClick={onCancel}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: danger
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'linear-gradient(135deg, var(--color-lavender), var(--color-sky))',
            color: danger ? '#fff' : 'var(--color-text)',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          {confirmLabel}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
