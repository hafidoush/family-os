import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import './Badge.css';

export type BadgeVariant =
  | 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  | 'cuisine' | 'enfants' | 'myself' | 'maison' | 'famille' | 'achats';

export type BadgeSize  = 'sm' | 'md' | 'lg';
export type BadgeShape = 'pill' | 'square';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:     BadgeVariant;
  size?:        BadgeSize;
  shape?:       BadgeShape;
  dot?:         boolean;
  iconLeft?:    ReactNode;
  onRemove?:    () => void;
  removeLabel?: string;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant     = 'default',
      size        = 'md',
      shape       = 'pill',
      dot         = false,
      iconLeft,
      onRemove,
      removeLabel = 'Retirer',
      className,
      children,
      ...rest
    },
    ref
  ) => {
    const cls = [
      'badge',
      `badge--${variant}`,
      `badge--${size}`,
      shape === 'square' && 'badge--square',
      onRemove && 'badge--chip',
      className,
    ].filter(Boolean).join(' ');

    return (
      <span ref={ref} className={cls} {...rest}>
        {dot && <span className="badge__dot" aria-hidden="true" />}
        {iconLeft && <span className="badge__icon" aria-hidden="true">{iconLeft}</span>}
        <span className="badge__label">{children}</span>
        {onRemove && (
          <button
            type="button"
            className="badge__remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label={removeLabel}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
              <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
export default Badge;
