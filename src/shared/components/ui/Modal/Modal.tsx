/**
 * FAMILY OS — Modal
 * Composant modal générique — glassmorphism fort, animation spring
 *
 * Variantes :
 *   - default  : modal centré (formulaires, confirmations)
 *   - sheet    : bottom sheet iOS (actions sur mobile)
 *   - alert    : modal compact centré (confirmations destructives)
 *
 * Accessibilité :
 *   - focus trap via tabIndex + onKeyDown
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - fermeture Escape
 *   - scroll interne si contenu dépasse la hauteur max
 *
 * Anatomie :
 *   <Modal>
 *     <Modal.Header />   ← optionnel
 *     <Modal.Body />     ← contenu principal
 *     <Modal.Footer />   ← optionnel (actions)
 *   </Modal>
 */

import {
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModalVariant = 'default' | 'sheet' | 'alert';
export type ModalSize    = 'sm' | 'md' | 'lg' | 'full';

export interface ModalProps {
  open?: boolean;
  /** Alias de open — rétrocompatibilité */
  isOpen?: boolean;
  onClose: () => void;
  variant?: ModalVariant;
  size?: ModalSize;
  /** Empêche la fermeture au clic sur le backdrop */
  persistent?: boolean;
  /** Id du titre pour aria-labelledby */
  titleId?: string;
  /** Titre affiché en en-tête (facultatif — peut aussi passer par les children) */
  title?: string;
  children: ReactNode;
  className?: string;
}

// ─── Context (pour composition Header/Body/Footer) ────────────────────────────

const ModalContext = createContext<{ onClose: () => void } | null>(null);

function useModalContext() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('Modal sub-components must be used inside <Modal>');
  return ctx;
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

interface ModalHeaderProps {
  children: ReactNode;
  /** Affiche le bouton ✕ de fermeture */
  showClose?: boolean;
  className?: string;
}

function ModalHeader({ children, showClose = true, className = '' }: ModalHeaderProps) {
  const { onClose } = useModalContext();
  return (
    <div className={`fos-modal-header ${className}`}>
      <div className="fos-modal-header-content">{children}</div>
      {showClose && (
        <button
          type="button"
          className="fos-modal-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

interface ModalBodyProps {
  children: ReactNode;
  className?: string;
  /** Désactive le padding interne */
  flush?: boolean;
}

function ModalBody({ children, className = '', flush = false }: ModalBodyProps) {
  return (
    <div className={`fos-modal-body${flush ? ' fos-modal-body--flush' : ''} ${className}`}>
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
  /** Alignement des boutons */
  align?: 'start' | 'center' | 'end' | 'stretch';
}

function ModalFooter({ children, className = '', align = 'end' }: ModalFooterProps) {
  return (
    <div className={`fos-modal-footer fos-modal-footer--${align} ${className}`}>
      {children}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const SIZE_MAP: Record<ModalSize, string> = {
  sm:   '400px',
  md:   '520px',
  lg:   '680px',
  full: 'calc(100vw - 2 * var(--space-4))',
};

export function Modal({
  open,
  isOpen,
  onClose,
  variant = 'default',
  size = 'md',
  persistent = false,
  titleId,
  title,
  children,
  className = '',
}: ModalProps) {
  // Support alias isOpen
  const isVisible = open ?? isOpen ?? false;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  // Focus trap & restore
  useEffect(() => {
    if (isVisible) {
      previousFocus.current = document.activeElement;
      // Focus le dialog au prochain frame pour laisser le CSS animer
      requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
      // Empêche le scroll du body
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape' && !persistent) {
        e.preventDefault();
        onClose();
      }
      // Focus trap minimal : Tab / Shift+Tab reste dans le dialog
      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    },
    [onClose, persistent]
  );

  const handleBackdropClick = useCallback(() => {
    if (!persistent) onClose();
  }, [onClose, persistent]);

  if (!isVisible) return null;

  const maxWidth = SIZE_MAP[size];

  return createPortal(
    <ModalContext.Provider value={{ onClose }}>
      {/* ── Styles injectés (une seule fois) ── */}
      <ModalStyles />

      {/* ── Backdrop ── */}
      <div
        className={`fos-modal-backdrop fos-modal-backdrop--${variant}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* ── Dialog ── */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`fos-modal fos-modal--${variant} fos-modal--${size} ${className}`}
        style={{ '--modal-max-width': maxWidth } as React.CSSProperties}
        onKeyDown={handleKeyDown}
        onClick={e => e.stopPropagation()}
      >
        {/* Highlight interne (effet verre) */}
        <div className="fos-modal-highlight" aria-hidden="true" />
        {children}
      </div>
    </ModalContext.Provider>,
    document.body
  );
}

// Attache les sous-composants
Modal.Header = ModalHeader;
Modal.Body   = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;

// ─── Styles ───────────────────────────────────────────────────────────────────

let stylesInjected = false;

function ModalStyles() {
  useEffect(() => {
    if (stylesInjected) return;
    stylesInjected = true;

    const style = document.createElement('style');
    style.id = 'fos-modal-styles';
    style.textContent = MODAL_CSS;
    document.head.appendChild(style);
  }, []);

  return null;
}

const MODAL_CSS = `
/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY OS — Modal styles
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Backdrop ───────────────────────────────────────────────────────────── */

.fos-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay, 300);
  background: var(--surface-overlay, hsla(262, 30%, 20%, 0.45));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: fos-backdrop-in var(--duration-normal, 200ms) var(--ease-out, ease) forwards;
}

.fos-modal-backdrop--sheet {
  background: var(--surface-overlay, hsla(262, 30%, 20%, 0.35));
}

@keyframes fos-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Dialog — base ──────────────────────────────────────────────────────── */

.fos-modal {
  position: fixed;
  z-index: var(--z-modal, 400);
  display: flex;
  flex-direction: column;
  outline: none;
  overflow: hidden;

  /* Glassmorphism fort */
  background: var(--glass-bg-strong, hsla(0, 0%, 100%, 0.88));
  backdrop-filter: var(--glass-blur-strong, blur(32px));
  -webkit-backdrop-filter: var(--glass-blur-strong, blur(32px));
  border: 1px solid var(--glass-border-strong, hsla(0, 0%, 100%, 0.75));
  box-shadow: var(--glass-shadow-strong, 0 16px 48px hsla(262, 30%, 20%, 0.16));
}

/* Reflet interne en haut (signature glassmorphism) */
.fos-modal-highlight {
  position: absolute;
  inset: 0;
  top: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    hsla(0, 0%, 100%, 0.7) 40%,
    hsla(0, 0%, 100%, 0.7) 60%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 1;
}

/* ── Variante default (centré) ──────────────────────────────────────────── */

.fos-modal--default {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(var(--modal-max-width, 520px), calc(100vw - var(--space-8, 2rem)));
  max-height: min(90dvh, 800px);
  border-radius: var(--radius-2xl, 20px);

  animation: fos-modal-in var(--duration-slow, 350ms) var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)) forwards;
}

@keyframes fos-modal-in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 12px)) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

/* ── Variante alert (compact, centré, légèrement smaller) ───────────────── */

.fos-modal--alert {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(360px, calc(100vw - var(--space-8, 2rem)));
  max-height: min(80dvh, 480px);
  border-radius: var(--radius-2xl, 20px);

  /* Ombre plus dramatique pour les alertes */
  box-shadow:
    0 20px 60px hsla(262, 30%, 20%, 0.20),
    0 4px 16px  hsla(262, 30%, 20%, 0.12);

  animation: fos-modal-alert-in var(--duration-normal, 200ms) var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)) forwards;
}

@keyframes fos-modal-alert-in {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

/* ── Variante sheet (bottom sheet iOS) ─────────────────────────────────── */

.fos-modal--sheet {
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-height: 92dvh;
  border-radius: var(--radius-2xl, 20px) var(--radius-2xl, 20px) 0 0;
  padding-bottom: var(--safe-bottom, 0px);

  /* Poignée en haut */
  padding-top: 20px;

  animation: fos-sheet-in var(--duration-slow, 350ms) var(--ease-snappy, cubic-bezier(0.2,0,0,1)) forwards;
}

.fos-modal--sheet::before {
  content: '';
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border-default, hsla(240, 7%, 82%, 1));
}

@keyframes fos-sheet-in {
  from {
    transform: translateY(100%);
    opacity: 0.8;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Sheet desktop : centré comme modal */
@media (min-width: 768px) {
  .fos-modal--sheet {
    bottom: auto;
    top: 50%;
    left: 50%;
    right: auto;
    width: min(560px, calc(100vw - 2rem));
    max-height: min(85dvh, 720px);
    border-radius: var(--radius-2xl, 20px);
    padding-top: 0;
    transform: translate(-50%, -50%);
    animation: fos-modal-in var(--duration-slow, 350ms) var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)) forwards;
  }
  .fos-modal--sheet::before { display: none; }
}

/* ── Header ─────────────────────────────────────────────────────────────── */

.fos-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-5, 1.25rem) var(--space-5, 1.25rem) var(--space-4, 1rem);
  border-bottom: 1px solid var(--border-subtle, hsla(240, 8%, 90%, 1));
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.fos-modal-header-content {
  flex: 1;
  min-width: 0;
}

.fos-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full, 9999px);
  border: none;
  background: var(--bg-sunken, var(--color-neutral-100));
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  margin-top: -2px;
  transition: var(--transition-interactive);
}

.fos-modal-close:hover {
  background: var(--border-subtle);
  color: var(--text-primary);
  transform: scale(1.08);
}

.fos-modal-close:active {
  transform: scale(0.94);
}

/* ── Body ───────────────────────────────────────────────────────────────── */

.fos-modal-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-5, 1.25rem);
  position: relative;
  z-index: 2;

  /* Scrollbar discrète */
  scrollbar-width: thin;
  scrollbar-color: var(--border-default) transparent;
}

.fos-modal-body::-webkit-scrollbar {
  width: 4px;
}
.fos-modal-body::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 2px;
}

.fos-modal-body--flush {
  padding: 0;
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

.fos-modal-footer {
  display: flex;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem) var(--space-5, 1.25rem);
  border-top: 1px solid var(--border-subtle, hsla(240, 8%, 90%, 1));
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.fos-modal-footer--start   { justify-content: flex-start; }
.fos-modal-footer--center  { justify-content: center; }
.fos-modal-footer--end     { justify-content: flex-end; }
.fos-modal-footer--stretch { & > * { flex: 1; } }

/* ── Dark mode ──────────────────────────────────────────────────────────── */

@media (prefers-color-scheme: dark) {
  .fos-modal {
    border-color: var(--glass-border-strong);
  }
  .fos-modal-highlight {
    background: linear-gradient(
      90deg,
      transparent 0%,
      hsla(0, 0%, 100%, 0.12) 40%,
      hsla(0, 0%, 100%, 0.12) 60%,
      transparent 100%
    );
  }
  .fos-modal-close {
    background: var(--surface-2);
  }
  .fos-modal-close:hover {
    background: var(--surface-1);
  }
}

/* ── Reduced motion ─────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .fos-modal,
  .fos-modal-backdrop {
    animation: none !important;
  }
  .fos-modal--default,
  .fos-modal--alert {
    transform: translate(-50%, -50%) !important;
    opacity: 1 !important;
  }
  .fos-modal--sheet {
    transform: translateY(0) !important;
    opacity: 1 !important;
  }
}
`;
