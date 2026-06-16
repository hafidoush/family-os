/**
 * FAMILY OS — EmptyState
 * Composant d'état vide. Utilisé quand une liste ou vue n'a pas encore de données.
 *
 * Props :
 *   icon        — emoji ou SVG React (optionnel)
 *   title       — titre principal (requis)
 *   description — texte d'accompagnement (optionnel)
 *   action      — bouton CTA principal (optionnel)
 *   secondaryAction — lien ou bouton secondaire (optionnel)
 *   variant     — 'default' | 'subtle' | 'module'
 *   moduleColor — surcharge de --primary pour la teinte module
 *   size        — 'sm' | 'md' | 'lg'
 *   className   — classes additionnelles
 *
 * Usage :
 *   <EmptyState
 *     icon="🍽️"
 *     title="Aucune recette pour l'instant"
 *     description="Ajoutez votre première recette pour commencer à planifier vos menus."
 *     action={{ label: 'Ajouter une recette', onClick: () => {} }}
 *   />
 */

import React from 'react';
import './EmptyState.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export interface EmptyStateSecondaryAction {
  label: string;
  onClick: () => void;
}

export type EmptyStateVariant = 'default' | 'subtle' | 'module';
export type EmptyStateSize = 'sm' | 'md' | 'lg';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateSecondaryAction;
  variant?: EmptyStateVariant;
  moduleColor?: string; // ex: 'var(--module-cuisine)'
  size?: EmptyStateSize;
  className?: string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  moduleColor,
  size = 'md',
  className = '',
}) => {
  const rootStyle = moduleColor
    ? ({ '--empty-accent': moduleColor } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={[
        'empty-state',
        `empty-state--${variant}`,
        `empty-state--${size}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={rootStyle}
      role="status"
      aria-label={title}
    >
      {/* Halo décoratif derrière l'icône */}
      {icon && (
        <div className="empty-state__halo" aria-hidden="true">
          <div className="empty-state__halo-ring empty-state__halo-ring--outer" />
          <div className="empty-state__halo-ring empty-state__halo-ring--inner" />
          <div className="empty-state__icon-wrap">
            <span className="empty-state__icon">{icon}</span>
          </div>
        </div>
      )}

      {/* Texte */}
      <div className="empty-state__body">
        <p className="empty-state__title">{title}</p>
        {description && (
          <p className="empty-state__description">{description}</p>
        )}
      </div>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="empty-state__actions">
          {action && (
            <button
              type="button"
              className="empty-state__btn empty-state__btn--primary press-effect"
              onClick={action.onClick}
            >
              {action.icon && (
                <span className="empty-state__btn-icon" aria-hidden="true">
                  {action.icon}
                </span>
              )}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              className="empty-state__btn empty-state__btn--secondary press-effect"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
