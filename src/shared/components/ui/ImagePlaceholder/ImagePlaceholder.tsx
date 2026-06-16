/**
 * FAMILY OS — ImagePlaceholder
 * Affiché quand un Blob image est absent (après import snapshot sans médias — D-19 / F-05).
 * Aussi utilisable comme skeleton pendant le chargement d'une image.
 *
 * Props :
 *   entityType — type d'entité pour l'icône et le label par défaut
 *   label      — texte alternatif libre (surcharge le label par défaut)
 *   aspectRatio — ratio CSS (ex: '4/3', '1/1', '16/9') — défaut '4/3'
 *   width      — largeur explicite (sinon 100%)
 *   height     — hauteur explicite (surcharge aspectRatio si défini)
 *   variant    — 'default' | 'loading' | 'error'
 *   radius     — rayon de bordure CSS (ex: 'var(--radius-md)') ou token
 *   showLabel  — afficher le label sous l'icône (défaut true)
 *   moduleColor — teinte accent (ex: 'var(--module-cuisine)')
 *   className
 *
 * Convention D-19 : les Blobs sont stockés dans IndexedDB.
 * Ce composant remplace toute image dont le Blob est null/undefined.
 */

import React from 'react';
import './ImagePlaceholder.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImageEntityType =
  | 'recette'
  | 'produit'
  | 'activite'
  | 'souvenir'
  | 'wishlist'
  | 'enfant'
  | 'piece'
  | 'generic';

export type ImagePlaceholderVariant = 'default' | 'loading' | 'error';

export interface ImagePlaceholderProps {
  entityType?: ImageEntityType;
  label?: string;
  /** Emoji ou icône SVG à afficher (surcharge l'icône du entityType) */
  icon?: string;
  aspectRatio?: string;
  width?: string | number;
  height?: string | number;
  variant?: ImagePlaceholderVariant;
  radius?: string;
  showLabel?: boolean;
  moduleColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

// ─── Métadonnées par type d'entité ────────────────────────────────────────────

const ENTITY_META: Record<ImageEntityType, { icon: string; label: string }> = {
  recette:   { icon: '🍽️',  label: 'Photo à ajouter'    },
  produit:   { icon: '🛒',  label: 'Visuel à ajouter'   },
  activite:  { icon: '🎨',  label: 'Illustration à ajouter' },
  souvenir:  { icon: '📷',  label: 'Photo à ajouter'    },
  wishlist:  { icon: '✨',  label: 'Visuel à ajouter'   },
  enfant:    { icon: '👤',  label: 'Photo de profil'    },
  piece:     { icon: '🏠',  label: 'Photo à ajouter'    },
  generic:   { icon: '🖼️', label: 'Image indisponible'  },
};

const VARIANT_META: Record<ImagePlaceholderVariant, { icon: string; label: string } | null> = {
  default: null, // utilise entityType
  loading: { icon: '',    label: 'Chargement…'     },
  error:   { icon: '⚠️', label: 'Image manquante'  },
};

// ─── Icône shimmer (loading) ──────────────────────────────────────────────────

const ShimmerIcon: React.FC = () => (
  <svg
    className="img-placeholder__shimmer-icon"
    viewBox="0 0 40 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="0" y="0" width="40" height="32" rx="4" fill="currentColor" opacity="0.12" />
    <circle cx="13" cy="11" r="4" fill="currentColor" opacity="0.25" />
    <path
      d="M0 22 L10 14 L18 20 L26 11 L40 22 L40 32 L0 32 Z"
      fill="currentColor"
      opacity="0.20"
    />
  </svg>
);

// ─── Composant ────────────────────────────────────────────────────────────────

export const ImagePlaceholder: React.FC<ImagePlaceholderProps> = ({
  entityType = 'generic',
  label,
  aspectRatio = '4/3',
  width,
  height,
  variant = 'default',
  radius,
  showLabel = true,
  moduleColor,
  className = '',
}) => {
  const meta =
    variant !== 'default' && VARIANT_META[variant]
      ? VARIANT_META[variant]!
      : ENTITY_META[entityType];

  const displayLabel = label ?? meta.label;
  const displayIcon  = meta.icon;

  const rootStyle: React.CSSProperties = {
    ...(moduleColor ? { '--img-placeholder-accent': moduleColor } as React.CSSProperties : {}),
    ...(radius      ? { '--img-placeholder-radius': radius }       as React.CSSProperties : {}),
    ...(width       ? { width: typeof width === 'number' ? `${width}px` : width }         : {}),
    ...(height
      ? { height: typeof height === 'number' ? `${height}px` : height }
      : { aspectRatio }),
  };

  return (
    <div
      className={[
        'img-placeholder',
        `img-placeholder--${variant}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={rootStyle}
      role="img"
      aria-label={displayLabel}
    >
      {/* Pattern décoratif en arrière-plan */}
      <div className="img-placeholder__pattern" aria-hidden="true" />

      {/* Contenu central */}
      <div className="img-placeholder__content">
        {variant === 'loading' ? (
          <ShimmerIcon />
        ) : (
          displayIcon && (
            <span className="img-placeholder__icon" aria-hidden="true">
              {displayIcon}
            </span>
          )
        )}

        {showLabel && (
          <span className="img-placeholder__label">{displayLabel}</span>
        )}
      </div>

      {/* Overlay shimmer animé (loading uniquement) */}
      {variant === 'loading' && (
        <div className="img-placeholder__shimmer-overlay" aria-hidden="true" />
      )}
    </div>
  );
};

export default ImagePlaceholder;
