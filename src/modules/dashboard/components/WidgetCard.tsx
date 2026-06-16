/**
 * WidgetCard — Enveloppe visuelle commune à tous les widgets Dashboard
 *
 * Fournit : glassmorphism, en-tête avec icône + titre, slot contenu,
 * état de chargement, état vide.
 *
 * Chaque widget l'utilise comme wrapper, ce qui garantit la cohérence
 * visuelle de la grille.
 */

import type { ReactNode } from 'react'
import './WidgetCard.css'

export interface WidgetCardProps {
  /** Emoji ou caractère unicode servant d'icône */
  icon?: string
  title: string
  /** Couleur d'accent (variable CSS ou valeur hex) — correspond au module */
  accentColor?: string
  /** Action optionnelle dans le header (ex: "Voir tout") */
  action?: ReactNode
  children: ReactNode
  /** Si true, affiche un skeleton de chargement */
  loading?: boolean
  /** Classes CSS additionnelles */
  className?: string
  /** Identifiant pour les tests / accessibilité */
  'aria-label'?: string
}

export function WidgetCard({
  icon,
  title,
  accentColor,
  action,
  children,
  loading = false,
  className = '',
  'aria-label': ariaLabel,
}: WidgetCardProps) {
  return (
    <article
      className={`widget-card ${className}`}
      aria-label={ariaLabel ?? title}
      style={accentColor ? ({ '--widget-accent': accentColor } as React.CSSProperties) : undefined}
    >
      <header className="widget-card__header">
        <div className="widget-card__title-group">
          {icon && (
            <span className="widget-card__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <h2 className="widget-card__title">{title}</h2>
        </div>
        {action && (
          <div className="widget-card__action">{action}</div>
        )}
      </header>

      <div className="widget-card__body">
        {loading ? (
          <WidgetCardSkeleton />
        ) : (
          children
        )}
      </div>
    </article>
  )
}

// ─── Skeleton de chargement ────────────────────────────────────────────────
function WidgetCardSkeleton() {
  return (
    <div className="widget-card__skeleton" aria-busy="true" aria-label="Chargement…">
      <div className="widget-card__skeleton-line widget-card__skeleton-line--lg" />
      <div className="widget-card__skeleton-line widget-card__skeleton-line--md" />
      <div className="widget-card__skeleton-line widget-card__skeleton-line--sm" />
      <div className="widget-card__skeleton-line widget-card__skeleton-line--md" />
    </div>
  )
}

export default WidgetCard
