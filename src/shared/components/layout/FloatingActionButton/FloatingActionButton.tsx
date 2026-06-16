/**
 * FAMILY OS — FloatingActionButton
 * Bouton flottant global accessible depuis tous les écrans.
 * Implémente l'automatisation A-31 : héritage du contexte module au moment du tap.
 *
 * Comportement :
 *   - Tap FAB → menu radial s'ouvre avec les 8 types de création rapide
 *   - module_origine pré-rempli avec le module actif (A-31)
 *   - Fermeture : tap extérieur, Escape, re-tap FAB, sélection d'une action
 *   - Backdrop flou sur l'app pendant l'ouverture
 *
 * Props :
 *   moduleOrigine  — module actif (injecté depuis navigationStore)
 *   moduleColor    — couleur du module actif
 *   onAction       — callback(type, context) déclenché à la sélection
 *   disabled       — désactive le FAB
 *
 * Structure des actions rapides (Master Spec §3) :
 *   tâche · note · idée · recette · produit · activité · achat · rendez-vous
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './FloatingActionButton.css';
import type { ModuleOrigine } from '../../../types/entities';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuickCreateType =
  | 'tache'
  | 'note'
  | 'idee'
  | 'recette'
  | 'produit'
  | 'activite'
  | 'achat'
  | 'rendez_vous'
  | 'pensee';

export interface FabContext {
  moduleOrigine: ModuleOrigine;
  /** Optionnel — pré-rempli si une pièce est sélectionnée dans la vue courante */
  pieceAssociee?: string;
  /** Optionnel — pré-rempli si un enfant est sélectionné dans la vue courante */
  enfantAssocie?: string;
}

export interface FabAction {
  type: QuickCreateType;
  label: string;
  icon: React.ReactNode;
  /** Modules pour lesquels cette action est mise en avant (ordre) */
  relevantModules?: ModuleOrigine[];
}

export interface FloatingActionButtonProps {
  moduleOrigine?: ModuleOrigine;
  moduleColor?: string;
  pieceAssociee?: string;
  enfantAssocie?: string;
  onAction?: (type: QuickCreateType, context: FabContext) => void;
  disabled?: boolean;
}

// ─── Catalogue des actions rapides ───────────────────────────────────────────

const FAB_ACTIONS: FabAction[] = [
  {
    type: 'tache',
    label: 'Tâche',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m19.75 7.018-9.257 9.257a1 1 0 0 1-1.414 0L4.25 11.446"/></svg>,
    relevantModules: ['maison', 'enfants', 'myself', 'dashboard'],
  },
  {
    type: 'note',
    label: 'Note',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 4.5 19.5 8.5 8.5 19.5 4 20l.5-4.5z"/><path d="M13.5 6.5 17.5 10.5"/></svg>,
    relevantModules: ['dashboard', 'famille', 'enfants'],
  },
  {
    type: 'idee',
    label: 'Idée',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.704 4.325a1.5 1.5 0 0 1 2.592 0l1.818 3.12a1.5 1.5 0 0 0 .978.712l3.53.764a1.5 1.5 0 0 1 .8 2.465l-2.405 2.693a1.5 1.5 0 0 0-.374 1.15l.363 3.593a1.5 1.5 0 0 1-2.097 1.524l-3.304-1.456a1.5 1.5 0 0 0-1.21 0l-3.304 1.456a1.5 1.5 0 0 1-2.097-1.524l.363-3.593a1.5 1.5 0 0 0-.373-1.15L3.578 11.386a1.5 1.5 0 0 1 .8-2.465l3.53-.764a1.5 1.5 0 0 0 .979-.711z"/></svg>,
    relevantModules: ['maison', 'achats'],
  },
  {
    type: 'recette',
    label: 'Recette',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16.929V10c0-3.771 0-5.657-1.172-6.828S16.771 2 13 2h-1C8.229 2 6.343 2 5.172 3.172S4 6.229 4 10v9.5"/><path d="M21 17H6.5a2.5 2.5 0 0 0 0 5H21"/><path d="M21 22a2.5 2.5 0 0 1 0-5"/><path d="M14.388 6.85a1.97 1.97 0 0 1 1.112-.341c1.105 0 2 .903 2 2.017 0 1.097-.904 2.014-2 2.014v.96c0 .943 0 1.414-.293 1.707s-.764.293-1.707.293h-2c-.943 0-1.414 0-1.707-.293S9.5 12.443 9.5 11.5v-.835c-1.168 0-2-.87-2-2.139 0-1.114.895-2.017 2-2.017.412 0 .794.125 1.112.34A2 2 0 0 1 12.5 5.5c.872 0 1.614.563 1.888 1.35"/></svg>,
    relevantModules: ['cuisine'],
  },
  {
    type: 'produit',
    label: 'Produit',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.25"/><path d="M12 8.5v7M8.5 12h7"/></svg>,
    relevantModules: ['cuisine', 'achats'],
  },
  {
    type: 'activite',
    label: 'Activité',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 11a1.5 1.5 0 0 1 0-3h.752a8.003 8.003 0 0 1 15.496 0H20a1.5 1.5 0 0 1 0 3h-.062a8.001 8.001 0 0 1-15.876 0z"/><path d="M4.5 8H6a6 6 0 0 0 6-6m7.5 6H18a6 6 0 0 1-6-6"/><path d="M12 15a1 1 0 0 0 1-1h-2a1 1 0 0 0 1 1Z"/><path d="M18 22c0-1.792-.786-3.4-2.031-4.5M6 22c0-1.792.786-3.4 2.031-4.5"/></svg>,
    relevantModules: ['enfants'],
  },
  {
    type: 'achat',
    label: 'Achat',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9.549" cy="19.049" r="1.701"/><circle cx="16.96" cy="19.049" r="1.701"/><path d="m5.606 5.555 2.01 6.364c.309.978.463 1.467.76 1.829.26.32.599.567.982.72.435.173.947.173 1.973.173h3.855c1.026 0 1.538 0 1.972-.173.384-.153.722-.4.983-.72.296-.362.45-.851.76-1.829l.409-1.296.24-.766.331-1.05a2.5 2.5 0 0 0-2.384-3.252zm0 0-.011-.037a7 7 0 0 0-.14-.42 2.92 2.92 0 0 0-2.512-1.84C2.84 3.25 2.727 3.25 2.5 3.25"/></svg>,
    relevantModules: ['achats', 'maison', 'myself'],
  },
  {
    type: 'rendez_vous',
    label: 'Rendez-vous',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.25 4.75H6.75a3.5 3.5 0 0 0-3.5 3.5v9.5a3.5 3.5 0 0 0 3.5 3.5h10.5a3.5 3.5 0 0 0 3.5-3.5v-9.5a3.5 3.5 0 0 0-3.5-3.5m-14 4.5h17.5M7.361 4.75v-2m9.25 2v-2"/></svg>,
    relevantModules: ['dashboard', 'famille'],
  },
  {
    type: 'pensee',
    label: 'Pensée',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7.09 2.75a4 4 0 0 0-4 4v6.208a4 4 0 0 0 4 4h.093v3.792a.5.5 0 0 0 .839.368l4.52-4.16h4.369a4 4 0 0 0 4-4V6.75a4 4 0 0 0-4-4z"/></svg>,
    relevantModules: ['dashboard', 'famille', 'myself'],
  },
];

// ─── Positions radiales des 8 items ──────────────────────────────────────────
// Arc de 180° centré en haut du FAB, en demi-cercle
// Angles en degrés depuis midi (haut), sens horaire
const ITEM_POSITIONS = [
  { angle: -160, radius: 78 },  // tache       (bas-gauche extrême)
  { angle: -125, radius: 84 },  // note
  { angle:  -90, radius: 90 },  // idee
  { angle:  -55, radius: 92 },  // recette
  { angle:  -20, radius: 92 },  // produit
  { angle:   15, radius: 88 },  // activite
  { angle:   50, radius: 84 },  // achat
  { angle:   85, radius: 80 },  // rendez-vous
  { angle:  120, radius: 78 },  // pensee      (bas-droite)
];

function polarToCartesian(angleDeg: number, radius: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: Math.cos(rad) * radius,
    y: Math.sin(rad) * radius,
  };
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  moduleOrigine = 'dashboard',
  moduleColor,
  pieceAssociee,
  enfantAssocie,
  onAction,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const fabRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Couleur effective
  const accentColor = moduleColor ?? 'var(--primary)';

  // Trier les actions : celles pertinentes au module courant en premier
  const sortedActions = [...FAB_ACTIONS].sort((a, b) => {
    const aRel = a.relevantModules?.includes(moduleOrigine) ? 0 : 1;
    const bRel = b.relevantModules?.includes(moduleOrigine) ? 0 : 1;
    return aRel - bRel;
  });

  const open = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setFocusedIndex(-1);
  }, [disabled]);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
    // Remettre le focus sur le FAB
    setTimeout(() => fabRef.current?.focus(), 50);
  }, []);

  const toggle = useCallback(() => {
    isOpen ? close() : open();
  }, [isOpen, open, close]);

  const handleAction = useCallback(
    (type: QuickCreateType) => {
      close();
      onAction?.(type, { moduleOrigine, pieceAssociee, enfantAssocie });
    },
    [close, onAction, moduleOrigine, pieceAssociee, enfantAssocie]
  );

  // Fermeture sur Escape et navigation clavier
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'Tab') {
        // Piéger le focus dans le menu
        e.preventDefault();
        const dir = e.shiftKey ? -1 : 1;
        setFocusedIndex((prev) => {
          const next = (prev + dir + sortedActions.length) % sortedActions.length;
          return next;
        });
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (focusedIndex >= 0) {
          e.preventDefault();
          handleAction(sortedActions[focusedIndex].type);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close, focusedIndex, sortedActions, handleAction]);

  // Focus sur l'item clavier
  useEffect(() => {
    if (focusedIndex >= 0 && menuRef.current) {
      const buttons = menuRef.current.querySelectorAll<HTMLButtonElement>(
        '.fab-menu__item-btn'
      );
      buttons[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        !fabRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        close();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, close]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fab-backdrop ${isOpen ? 'fab-backdrop--visible' : ''}`}
        aria-hidden="true"
        onClick={close}
      />

      {/* Conteneur positionné */}
      <div
        className="fab-root"
        style={{ '--fab-accent': accentColor } as React.CSSProperties}
      >
        {/* Menu radial */}
        <div
          ref={menuRef}
          className={`fab-menu ${isOpen ? 'fab-menu--open' : ''}`}
          role="menu"
          aria-label="Créer rapidement"
          aria-hidden={!isOpen}
        >
          {sortedActions.map((action, index) => {
            const pos = ITEM_POSITIONS[index];
            const { x, y } = polarToCartesian(pos.angle, pos.radius);
            const isRelevant = action.relevantModules?.includes(moduleOrigine);
            // Délai d'animation échelonné
            const delay = isOpen ? index * 28 : (sortedActions.length - 1 - index) * 18;

            return (
              <div
                key={action.type}
                className={[
                  'fab-menu__item',
                  isRelevant ? 'fab-menu__item--relevant' : '',
                  isOpen ? 'fab-menu__item--visible' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  {
                    '--item-x': `${x}px`,
                    '--item-y': `${y}px`,
                    '--item-delay': `${delay}ms`,
                  } as React.CSSProperties
                }
              >
                <button
                  type="button"
                  className="fab-menu__item-btn press-effect"
                  role="menuitem"
                  aria-label={action.label}
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => handleAction(action.type)}
                >
                  <span className="fab-menu__item-icon" aria-hidden="true">
                    {action.icon}
                  </span>
                </button>
                <span className="fab-menu__item-label" aria-hidden="true">
                  {action.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bouton FAB principal */}
        <button
          ref={fabRef}
          type="button"
          className={[
            'fab-btn',
            'press-effect',
            isOpen ? 'fab-btn--open' : '',
            disabled ? 'fab-btn--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={toggle}
          aria-label={isOpen ? 'Fermer le menu de création' : 'Créer rapidement'}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          disabled={disabled}
        >
          {/* Halo de pulsation (état fermé) */}
          {!isOpen && !disabled && (
            <span className="fab-btn__pulse" aria-hidden="true" />
          )}

          {/* Icône + → × */}
          <span
            className="fab-btn__icon"
            aria-hidden="true"
            style={{
              transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            }}
          >
            +
          </span>
        </button>

        {/* Label module (visible quand menu ouvert) */}
        <div
          className={`fab-module-label ${isOpen ? 'fab-module-label--visible' : ''}`}
          aria-hidden="true"
        >
          {moduleOrigine.charAt(0).toUpperCase() + moduleOrigine.slice(1)}
        </div>
      </div>
    </>
  );
};

export default FloatingActionButton;
