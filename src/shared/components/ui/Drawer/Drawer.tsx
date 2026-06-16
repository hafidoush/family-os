/**
 * FAMILY OS — Drawer
 * Composant UI partagé · src/shared/components/ui/Drawer.tsx
 *
 * Usage :
 *   <Drawer isOpen={open} onClose={() => setOpen(false)} title="Créer une tâche">
 *     {children}
 *   </Drawer>
 *
 * Props :
 *   isOpen        — contrôle la visibilité
 *   onClose       — callback de fermeture (backdrop, swipe-down, bouton ×)
 *   title         — titre affiché dans le header (optionnel)
 *   description   — sous-titre/description (optionnel)
 *   size          — 'sm' | 'md' | 'lg' | 'full' (défaut : 'md')
 *   anchor        — 'bottom' | 'right' (défaut : 'bottom' sur mobile, 'right' sur ≥768px)
 *   showHandle    — afficher la poignée de swipe (défaut : true sur bottom)
 *   footer        — contenu du footer (boutons d'action)
 *   className     — classes additionnelles sur le panel
 *
 * Accessibilité :
 *   - role="dialog" + aria-modal + aria-labelledby + aria-describedby
 *   - Focus trap : premier élément focusable à l'ouverture, retour au déclencheur à la fermeture
 *   - Fermeture Escape
 *   - Scroll lock sur body quand ouvert
 *
 * Animations :
 *   - Entrée : slide-up (bottom) ou slide-in-right (right) + fade backdrop
 *   - Sortie : slide-down / slide-out-right
 *   - Swipe-to-dismiss sur mobile (bottom anchor)
 *   - Ressort CSS (--ease-spring) sur l'entrée
 *
 * Contraintes :
 *   - Aucune valeur brute — uniquement des tokens CSS (tokens.css)
 *   - Aucun import cross-module
 *   - Compatible PWA standalone iOS (safe-area-inset-bottom)
 */

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DrawerSize   = 'sm' | 'md' | 'lg' | 'full';
export type DrawerAnchor = 'bottom' | 'right';

export interface DrawerProps {
  isOpen:       boolean;
  onClose:      () => void;
  title?:       string;
  description?: string;
  size?:        DrawerSize;
  anchor?:      DrawerAnchor;
  showHandle?:  boolean;
  footer?:      ReactNode;
  children?:    ReactNode;
  className?:   string;
  /** Identifiant pour les tests / analytics */
  id?:          string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Seuil (px) pour déclencher le dismiss sur swipe-down */
const SWIPE_DISMISS_THRESHOLD = 120;
/** Vélocité minimale (px/ms) pour dismiss rapide même sous le seuil */
const SWIPE_VELOCITY_THRESHOLD = 0.5;

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/** Retourne tous les éléments focusables dans un conteneur */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => !el.closest('[aria-hidden="true"]'));
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const DRAWER_CSS = `
/* ── Drawer styles — injectés une seule fois dans <head> ── */

/* Overlay / backdrop */
.fos-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: var(--surface-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-normal) var(--ease-out);
  will-change: opacity;
}
.fos-drawer-backdrop.is-open {
  opacity: 1;
  pointer-events: auto;
}

/* Panel commun */
.fos-drawer-panel {
  position: fixed;
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-blur-strong);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  border: 1px solid var(--glass-border-strong);
  box-shadow: var(--glass-shadow-strong);
  will-change: transform, opacity;
  overflow: hidden;
  pointer-events: none;

  /* Typographie de base */
  font-family: var(--font-body);
  color: var(--text-primary);
}

/* ── Ancre BOTTOM ── */
.fos-drawer-panel[data-anchor="bottom"] {
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
  padding-bottom: var(--safe-bottom);

  /* Slide depuis le bas */
  transform: translateY(100%);
  opacity: 0;
  transition:
    transform var(--duration-slow) var(--ease-spring),
    opacity   var(--duration-normal) var(--ease-out);
}
.fos-drawer-panel[data-anchor="bottom"].is-open {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

/* Tailles — hauteur max (bottom) */
.fos-drawer-panel[data-anchor="bottom"][data-size="sm"]   { max-height: 35dvh; }
.fos-drawer-panel[data-anchor="bottom"][data-size="md"]   { max-height: 60dvh; }
.fos-drawer-panel[data-anchor="bottom"][data-size="lg"]   { max-height: 82dvh; }
.fos-drawer-panel[data-anchor="bottom"][data-size="full"] { max-height: 94dvh; }

/* ── Ancre RIGHT ── */
.fos-drawer-panel[data-anchor="right"] {
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: var(--radius-2xl) 0 0 var(--radius-2xl);

  transform: translateX(100%);
  opacity: 0;
  transition:
    transform var(--duration-slow) var(--ease-spring),
    opacity   var(--duration-normal) var(--ease-out);
}
.fos-drawer-panel[data-anchor="right"].is-open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

/* Tailles — largeur (right) */
.fos-drawer-panel[data-anchor="right"][data-size="sm"]   { width: min(320px, 90vw); }
.fos-drawer-panel[data-anchor="right"][data-size="md"]   { width: min(420px, 90vw); }
.fos-drawer-panel[data-anchor="right"][data-size="lg"]   { width: min(560px, 92vw); }
.fos-drawer-panel[data-anchor="right"][data-size="full"] { width: 100vw; border-radius: 0; }

/* ── Poignée swipe ── */
.fos-drawer-handle {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-3) var(--space-4) var(--space-1);
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.fos-drawer-handle:active { cursor: grabbing; }

.fos-drawer-handle-bar {
  width: 36px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--border-default);
  transition: background var(--duration-fast) var(--ease-out),
              width var(--duration-fast) var(--ease-spring);
}
.fos-drawer-handle:hover .fos-drawer-handle-bar,
.fos-drawer-handle:active .fos-drawer-handle-bar {
  background: var(--border-strong);
  width: 44px;
}

/* ── Header ── */
.fos-drawer-header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5) var(--space-3);
}
/* Quand il y a une poignée, on réduit le padding top du header */
.fos-drawer-panel[data-anchor="bottom"] .fos-drawer-handle + .fos-drawer-header {
  padding-top: var(--space-2);
}

.fos-drawer-header-text {
  flex: 1;
  min-width: 0;
}

.fos-drawer-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--leading-tight);
  color: var(--text-primary);
  margin: 0;
  /* Cormorant/Lora ont une belle lettre italique — on en profite légèrement */
  font-style: normal;
  letter-spacing: -0.01em;
}

.fos-drawer-description {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
}

/* Bouton fermeture */
.fos-drawer-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 18px;
  line-height: 1;
  transition: var(--transition-interactive);
  -webkit-tap-highlight-color: transparent;
  margin-top: 2px; /* alignement optique avec le titre */
}
.fos-drawer-close:hover {
  background: var(--primary-subtle);
  color: var(--primary-dark);
  transform: scale(1.05);
}
.fos-drawer-close:active {
  transform: scale(0.92);
  background: var(--primary-subtle);
}

/* ── Séparateur optique sous le header ── */
.fos-drawer-divider {
  flex-shrink: 0;
  height: 1px;
  margin: 0 var(--space-5);
  background: linear-gradient(
    90deg,
    transparent,
    var(--border-subtle) 20%,
    var(--border-subtle) 80%,
    transparent
  );
}

/* ── Body — zone scrollable ── */
.fos-drawer-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-4) var(--space-5);
  overscroll-behavior: contain;

  /* Scrollbar discrète */
  scrollbar-width: thin;
  scrollbar-color: var(--border-subtle) transparent;
}
.fos-drawer-body::-webkit-scrollbar { width: 4px; }
.fos-drawer-body::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: var(--radius-full);
}

/* ── Footer ── */
.fos-drawer-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  background: linear-gradient(
    0deg,
    var(--glass-bg-strong) 70%,
    transparent
  );
}

/* ── Transition de translation pendant le swipe (inline style) ── */
.fos-drawer-panel.is-swiping {
  transition: none !important;
}

/* ── Accessibilité : focus visible ── */
.fos-drawer-panel *:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .fos-drawer-backdrop,
  .fos-drawer-panel {
    transition-duration: var(--duration-instant) !important;
  }
}
`;

// ─── Hook : injection du CSS ─────────────────────────────────────────────────

function useDrawerStyles() {
  useEffect(() => {
    const id = 'fos-drawer-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = DRAWER_CSS;
      document.head.appendChild(style);
    }
  }, []);
}

// ─── Hook : scroll lock ──────────────────────────────────────────────────────

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

// ─── Hook : focus trap ───────────────────────────────────────────────────────

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  // Mémorise l'élément actif avant ouverture
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (active) {
      triggerRef.current = document.activeElement;
      // Petit délai pour laisser l'animation démarrer
      const raf = requestAnimationFrame(() => {
        if (!ref.current) return;
        const focusable = getFocusableElements(ref.current);
        focusable[0]?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(raf);
    } else {
      // Retour au déclencheur
      (triggerRef.current as HTMLElement | null)?.focus({ preventScroll: true });
    }
  }, [active, ref]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const focusable = getFocusableElements(ref.current);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [ref]);

  return { handleKeyDown };
}

// ─── Hook : swipe-to-dismiss (bottom anchor) ─────────────────────────────────

interface SwipeState {
  active:    boolean;
  startY:    number;
  currentY:  number;
  startTime: number;
}

function useSwipeDismiss(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled: boolean,
) {
  const [swipe, setSwipe] = useState<SwipeState>({
    active: false, startY: 0, currentY: 0, startTime: 0,
  });

  const deltaY = swipe.active ? Math.max(0, swipe.currentY - swipe.startY) : 0;

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    // Ne pas intercepter les clics sur des éléments interactifs
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a, [role="button"], [role="checkbox"], [role="switch"], label')) return;
    // Uniquement si on est en haut du scroll ou sur la poignée
    const el = ref.current;
    if (!el) return;
    const body = el.querySelector('.fos-drawer-body') as HTMLElement | null;
    if (body && body.scrollTop > 0 && !(e.target as HTMLElement).closest('.fos-drawer-handle')) return;

    setSwipe({
      active: true,
      startY: e.clientY,
      currentY: e.clientY,
      startTime: Date.now(),
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [enabled, ref]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipe.active) return;
    setSwipe(s => ({ ...s, currentY: e.clientY }));
  }, [swipe.active]);

  const onPointerUp = useCallback(() => {
    if (!swipe.active) return;
    const delta    = Math.max(0, swipe.currentY - swipe.startY);
    const elapsed  = Date.now() - swipe.startTime;
    const velocity = elapsed > 0 ? delta / elapsed : 0;

    if (delta > SWIPE_DISMISS_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
      onClose();
    }
    setSwipe(s => ({ ...s, active: false, currentY: s.startY }));
  }, [swipe, onClose]);

  // Style inline pour l'animation pendant le swipe
  const swipeStyle = swipe.active && deltaY > 0
    ? { transform: `translateY(${deltaY}px)`, opacity: Math.max(0, 1 - deltaY / 300) }
    : undefined;

  return { onPointerDown, onPointerMove, onPointerUp, swipeStyle, isSwiping: swipe.active && deltaY > 0 };
}

// ─── Composant principal ─────────────────────────────────────────────────────

let titleIdCounter = 0;
let descIdCounter  = 0;

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  size       = 'md',
  anchor     = 'bottom',
  showHandle = true,
  footer,
  children,
  className = '',
  id,
}: DrawerProps) {

  useDrawerStyles();
  useScrollLock(isOpen);

  const panelRef = useRef<HTMLDivElement>(null);

  // Identifiants ARIA stables (générés une seule fois par instance)
  const titleId = useRef(`fos-drawer-title-${++titleIdCounter}`).current;
  const descId  = useRef(`fos-drawer-desc-${++descIdCounter}`).current;

  // Focus trap
  const { handleKeyDown } = useFocusTrap(panelRef, isOpen);

  // Fermeture Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Swipe-to-dismiss (bottom uniquement)
  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    swipeStyle,
    isSwiping,
  } = useSwipeDismiss(panelRef, onClose, anchor === 'bottom');

  // Icône fermeture (×) — SVG inline pour zéro dépendance
  const CloseIcon = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  // Ne pas rendre dans le DOM si non monté (évite le layout shift initial)
  // mais garder le portal pour les transitions de sortie
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fos-drawer-backdrop${isOpen ? ' is-open' : ''}`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        data-anchor={anchor}
        data-size={size}
        className={[
          'fos-drawer-panel',
          isOpen   ? 'is-open'    : '',
          isSwiping ? 'is-swiping' : '',
          className,
        ].filter(Boolean).join(' ')}
        style={swipeStyle}
        onKeyDown={handleKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        tabIndex={-1}
      >

        {/* Poignée swipe (bottom uniquement) */}
        {anchor === 'bottom' && showHandle && (
          <div
            className="fos-drawer-handle"
            aria-hidden="true"
            title="Glisser vers le bas pour fermer"
          >
            <div className="fos-drawer-handle-bar" />
          </div>
        )}

        {/* Header */}
        {(title || description) && (
          <>
            <div className="fos-drawer-header">
              <div className="fos-drawer-header-text">
                {title && (
                  <h2 id={titleId} className="fos-drawer-title">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="fos-drawer-description">
                    {description}
                  </p>
                )}
              </div>

              <button
                type="button"
                className="fos-drawer-close"
                onClick={onClose}
                aria-label="Fermer"
              >
                {CloseIcon}
              </button>
            </div>

            <div className="fos-drawer-divider" aria-hidden="true" />
          </>
        )}

        {/* Corps — scrollable */}
        <div className="fos-drawer-body">
          {children}
        </div>

        {/* Footer (optionnel) */}
        {footer && (
          <div className="fos-drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

export default Drawer;
