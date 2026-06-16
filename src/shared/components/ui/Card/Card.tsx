/**
 * FAMILY OS — Card
 * Composant de carte universel du design system.
 *
 * Variantes :
 *   default   — verre dépoli standard (usage général)
 *   tinted    — verre teinté lavande (widget Dashboard, mise en avant)
 *   flat      — surface opaque sans blur (listes denses, tablette cuisine)
 *   ghost     — contour seul, fond transparent (état vide, placeholder)
 *   elevated  — ombre renforcée sans glass (modals inline, projets)
 *
 * Props de comportement :
 *   interactive  — hover + press effect (cliquable)
 *   selected     — état sélectionné (ring brand)
 *   disabled     — opacité réduite, non cliquable
 *   fullWidth    — 100% de la largeur parente
 *
 * Composition :
 *   <Card>
 *     <Card.Header>          — bande supérieure (icon + titre + action)
 *     <Card.Body>            — contenu principal (padding standard)
 *     <Card.Footer>          — bande inférieure (actions, métadonnées)
 *     <Card.Divider />       — séparateur interne
 *   </Card>
 *
 * Convention : pas de valeurs brutes — uniquement les tokens de tokens.css
 */

import React, {
  createContext,
  useContext,
  forwardRef,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  type CSSProperties,
} from 'react';

// ─── Styles injectés ─────────────────────────────────────────────────────────

const CARD_STYLES = `
/* ── Card Base ──────────────────────────────────────────────────────────── */
.fos-card {
  position: relative;
  border-radius: var(--card-radius);
  padding: var(--card-padding);
  overflow: hidden;
  outline: none;

  /* Transitions */
  transition:
    box-shadow       var(--duration-normal) var(--ease-out),
    transform        var(--duration-fast)   var(--ease-spring),
    border-color     var(--duration-fast)   var(--ease-out),
    opacity          var(--duration-fast)   var(--ease-out),
    background-color var(--duration-normal) var(--ease-out);
}

/* ── Variante : default (glass) ─────────────────────────────────────────── */
.fos-card--default {
  background:         var(--card-bg);
  border:             1px solid var(--card-border);
  backdrop-filter:    var(--card-blur);
  -webkit-backdrop-filter: var(--card-blur);
  box-shadow:         var(--card-shadow);
}

/* ── Variante : tinted (glass lavande) ──────────────────────────────────── */
.fos-card--tinted {
  background:         var(--glass-bg-tinted);
  border:             1px solid var(--glass-border-tinted);
  backdrop-filter:    var(--glass-blur-tinted);
  -webkit-backdrop-filter: var(--glass-blur-tinted);
  box-shadow:         var(--glass-shadow-light);
}

/* ── Variante : flat (opaque, pas de blur) ──────────────────────────────── */
.fos-card--flat {
  background:         var(--surface-1);
  border:             1px solid var(--border-subtle);
  box-shadow:         var(--shadow-xs);
}

/* ── Variante : ghost (contour seul) ────────────────────────────────────── */
.fos-card--ghost {
  background:         transparent;
  border:             1.5px dashed var(--border-default);
  box-shadow:         none;
}

/* ── Variante : elevated ────────────────────────────────────────────────── */
.fos-card--elevated {
  background:         var(--surface-1);
  border:             1px solid var(--border-subtle);
  box-shadow:         var(--shadow-lg);
}

/* ── État interactif ────────────────────────────────────────────────────── */
.fos-card--interactive {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
}

.fos-card--interactive:hover {
  box-shadow:    var(--elevation-card-hover);
  transform:     translateY(-1px);
}

.fos-card--interactive:hover.fos-card--default {
  background:    var(--glass-bg-strong);
  border-color:  var(--glass-border);
}

.fos-card--interactive:active,
.fos-card--interactive.fos-card--pressing {
  transform:     scale(0.985) translateY(0px);
  box-shadow:    var(--elevation-card);
  opacity:       0.92;
}

/* ── État focus clavier ──────────────────────────────────────────────────── */
.fos-card--interactive:focus-visible {
  outline:       2px solid var(--border-focus);
  outline-offset: 2px;
  box-shadow:    var(--elevation-card-hover), 0 0 0 4px var(--primary-subtle);
}

/* ── État selected ───────────────────────────────────────────────────────── */
.fos-card--selected {
  border-color:  var(--border-brand);
  box-shadow:    var(--shadow-sm), 0 0 0 3px var(--primary-subtle);
}

.fos-card--selected.fos-card--default,
.fos-card--selected.fos-card--tinted {
  background:    var(--glass-bg-tinted);
}

/* ── État disabled ───────────────────────────────────────────────────────── */
.fos-card--disabled {
  opacity:       0.48;
  cursor:        not-allowed;
  pointer-events: none;
}

/* ── Full width ──────────────────────────────────────────────────────────── */
.fos-card--full-width {
  width: 100%;
}

/* ── Trait lumineux supérieur (optionnel, via prop shine) ────────────────── */
.fos-card--shine::before {
  content:  '';
  position: absolute;
  top:      0;
  left:     10%;
  right:    10%;
  height:   1px;
  background: linear-gradient(
    90deg,
    transparent,
    hsla(0, 0%, 100%, 0.6) 40%,
    hsla(0, 0%, 100%, 0.6) 60%,
    transparent
  );
  pointer-events: none;
}

/* ── Indicateur couleur latéral (accent left border) ────────────────────── */
.fos-card--accented::after {
  content:         '';
  position:        absolute;
  top:             var(--radius-card);
  bottom:          var(--radius-card);
  left:            0;
  width:           3px;
  border-radius:   0 2px 2px 0;
  background:      var(--card-accent-color, var(--primary));
}

/* ── Card.Header ─────────────────────────────────────────────────────────── */
.fos-card__header {
  display:         flex;
  align-items:     center;
  gap:             var(--space-3);
  margin-bottom:   var(--space-3);
}

.fos-card__header--standalone {
  /* Quand Header est le seul enfant sans Body */
  margin-bottom: 0;
}

.fos-card__header-icon {
  display:         flex;
  align-items:     center;
  justify-content: center;
  flex-shrink:     0;
  width:           36px;
  height:          36px;
  border-radius:   var(--radius-lg);
  background:      var(--primary-subtle);
  color:           var(--primary);
  font-size:       var(--text-lg);
  line-height:     1;
}

.fos-card__header-icon--sm {
  width:  28px;
  height: 28px;
  font-size: var(--text-base);
  border-radius: var(--radius-md);
}

.fos-card__header-icon--lg {
  width:  44px;
  height: 44px;
  font-size: var(--text-xl);
  border-radius: var(--radius-xl);
}

.fos-card__header-content {
  flex: 1;
  min-width: 0; /* permet le text-overflow */
}

.fos-card__header-title {
  font-family:    var(--font-display);
  font-size:      var(--text-base);
  font-weight:    var(--font-weight-semibold);
  color:          var(--text-primary);
  line-height:    var(--leading-snug);
  white-space:    nowrap;
  overflow:       hidden;
  text-overflow:  ellipsis;
}

.fos-card__header-subtitle {
  font-family:    var(--font-body);
  font-size:      var(--text-xs);
  color:          var(--text-tertiary);
  margin-top:     2px;
  line-height:    var(--leading-normal);
  white-space:    nowrap;
  overflow:       hidden;
  text-overflow:  ellipsis;
}

.fos-card__header-action {
  flex-shrink:    0;
  margin-left:    auto;
}

/* ── Card.Body ───────────────────────────────────────────────────────────── */
.fos-card__body {
  /* Hérite du padding de la carte parente */
}

.fos-card__body + .fos-card__footer {
  margin-top: var(--space-3);
}

/* ── Card.Footer ─────────────────────────────────────────────────────────── */
.fos-card__footer {
  display:        flex;
  align-items:    center;
  gap:            var(--space-2);
  padding-top:    var(--space-3);
  border-top:     1px solid var(--border-subtle);
  margin-top:     var(--space-3);
}

.fos-card__footer--flush {
  /* Sans padding ni bordure (footer dense) */
  padding-top:    0;
  border-top:     none;
  margin-top:     var(--space-2);
}

.fos-card__footer--right {
  justify-content: flex-end;
}

.fos-card__footer--space-between {
  justify-content: space-between;
}

/* ── Card.Divider ────────────────────────────────────────────────────────── */
.fos-card__divider {
  height:       1px;
  background:   var(--border-subtle);
  margin:       var(--space-3) calc(-1 * var(--card-padding));
  /* S'étend jusqu'aux bords de la carte en annulant le padding */
}

/* ── Padding overrides ───────────────────────────────────────────────────── */
.fos-card--padding-sm  { --card-padding: var(--space-3); }
.fos-card--padding-lg  { --card-padding: var(--space-6); }
.fos-card--padding-none{ --card-padding: 0; }
`;

// ─── Injection des styles ─────────────────────────────────────────────────────

function injectStyles() {
  if (typeof document === 'undefined') return;
  const id = 'fos-card-styles';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = CARD_STYLES;
    document.head.appendChild(style);
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface CardContextValue {
  variant: CardVariant;
  padding: CardPadding;
}

const CardContext = createContext<CardContextValue>({
  variant: 'default',
  padding: 'md',
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardVariant = 'default' | 'tinted' | 'flat' | 'ghost' | 'elevated';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Variante visuelle */
  variant?: CardVariant;
  /** Taille du padding interne */
  padding?: CardPadding;
  /** Rend la carte cliquable (hover + press) */
  interactive?: boolean;
  /** État sélectionné (ring brand) */
  selected?: boolean;
  /** État désactivé */
  disabled?: boolean;
  /** 100% de largeur */
  fullWidth?: boolean;
  /** Trait lumineux en haut de la carte */
  shine?: boolean;
  /** Bande colorée latérale gauche */
  accented?: boolean;
  /** Couleur de l'accent (CSS color) — requiert accented=true */
  accentColor?: string;
  /** Override du onClick avec sémantique bouton (rôle + keydown) */
  onPress?: () => void;
}

// ─── Composant Card ───────────────────────────────────────────────────────────

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      interactive = false,
      selected = false,
      disabled = false,
      fullWidth = false,
      shine = false,
      accented = false,
      accentColor,
      onPress,
      onClick,
      className = '',
      children,
      style,
      ...rest
    },
    ref
  ) => {
    injectStyles();

    const isInteractive = interactive || !!onPress || !!onClick;

    const classes = [
      'fos-card',
      `fos-card--${variant}`,
      padding !== 'md' && `fos-card--padding-${padding}`,
      isInteractive && 'fos-card--interactive',
      selected && 'fos-card--selected',
      disabled && 'fos-card--disabled',
      fullWidth && 'fos-card--full-width',
      shine && 'fos-card--shine',
      accented && 'fos-card--accented',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const inlineStyle: CSSProperties = {
      ...(accentColor ? ({ '--card-accent-color': accentColor } as CSSProperties) : {}),
      ...style,
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onPress?.();
      }
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onClick?.(e);
      onPress?.();
    };

    return (
      <CardContext.Provider value={{ variant, padding }}>
        <div
          ref={ref}
          className={classes}
          style={inlineStyle}
          onClick={handleClick}
          onKeyDown={isInteractive ? handleKeyDown : undefined}
          role={isInteractive ? 'button' : undefined}
          tabIndex={isInteractive && !disabled ? 0 : undefined}
          aria-disabled={disabled || undefined}
          aria-pressed={isInteractive && selected ? true : undefined}
          {...rest}
        >
          {children}
        </div>
      </CardContext.Provider>
    );
  }
);

Card.displayName = 'Card';

// ─── Card.Header ──────────────────────────────────────────────────────────────

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Icône ou emoji affiché dans un conteneur circulaire */
  icon?: ReactNode;
  /** Taille de l'icône */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Couleur de fond du conteneur icône (CSS color) */
  iconColor?: string;
  /** Titre principal */
  title?: ReactNode;
  /** Sous-titre ou metadata */
  subtitle?: ReactNode;
  /** Élément à droite (badge, bouton, chevron…) */
  action?: ReactNode;
  /** Pas de margin-bottom (header seul sans body) */
  standalone?: boolean;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  (
    {
      icon,
      iconSize = 'md',
      iconColor,
      title,
      subtitle,
      action,
      standalone = false,
      className = '',
      children,
      style,
      ...rest
    },
    ref
  ) => {
    const classes = [
      'fos-card__header',
      standalone && 'fos-card__header--standalone',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classes} style={style} {...rest}>
        {icon && (
          <div
            className={`fos-card__header-icon fos-card__header-icon--${iconSize}`}
            style={
              iconColor
                ? ({
                    background: iconColor + '20', // 12% opacity
                    color: iconColor,
                  } as CSSProperties)
                : undefined
            }
            aria-hidden="true"
          >
            {icon}
          </div>
        )}

        {(title || subtitle) && (
          <div className="fos-card__header-content">
            {title && <div className="fos-card__header-title">{title}</div>}
            {subtitle && (
              <div className="fos-card__header-subtitle">{subtitle}</div>
            )}
          </div>
        )}

        {children}

        {action && (
          <div className="fos-card__header-action">{action}</div>
        )}
      </div>
    );
  }
);

CardHeader.displayName = 'Card.Header';

// ─── Card.Body ────────────────────────────────────────────────────────────────

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={`fos-card__body ${className}`} {...rest}>
      {children}
    </div>
  )
);

CardBody.displayName = 'Card.Body';

// ─── Card.Footer ──────────────────────────────────────────────────────────────

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** Sans padding ni bordure */
  flush?: boolean;
  /** Alignement des enfants */
  align?: 'left' | 'right' | 'space-between';
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  (
    { flush = false, align = 'left', className = '', children, ...rest },
    ref
  ) => {
    const classes = [
      'fos-card__footer',
      flush && 'fos-card__footer--flush',
      align === 'right' && 'fos-card__footer--right',
      align === 'space-between' && 'fos-card__footer--space-between',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classes} {...rest}>
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'Card.Footer';

// ─── Card.Divider ─────────────────────────────────────────────────────────────

export interface CardDividerProps extends HTMLAttributes<HTMLHRElement> {}

export const CardDivider = forwardRef<HTMLHRElement, CardDividerProps>(
  ({ className = '', ...rest }, ref) => (
    <hr
      ref={ref}
      className={`fos-card__divider ${className}`}
      aria-hidden="true"
      {...rest}
    />
  )
);

CardDivider.displayName = 'Card.Divider';

// ─── Exports nommés via namespacing ──────────────────────────────────────────

// Attacher les sous-composants via cast pour éviter les conflits de types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CardWithSubs = Card as any;
CardWithSubs.Header  = CardHeader;
CardWithSubs.Body    = CardBody;
CardWithSubs.Footer  = CardFooter;
CardWithSubs.Divider = CardDivider;

// ─── Export default ───────────────────────────────────────────────────────────

export default Card;

// ─── Hook utilitaire (accès au contexte depuis les enfants) ───────────────────

export function useCardContext(): CardContextValue {
  return useContext(CardContext);
}
