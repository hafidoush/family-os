/**
 * FAMILY OS — Checkbox Component
 * Cases à cocher natives enrichies.
 * Variants : default | card (toute la surface cliquable avec fond)
 * Tailles : sm | md | lg
 * Support : indeterminate, description, error, disabled
 */

import React, { forwardRef, useId } from 'react';
import './Checkbox.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckboxSize    = 'sm' | 'md' | 'lg';
export type CheckboxVariant = 'default' | 'card';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  /** Libellé principal */
  label?: string;
  /** Description secondaire sous le label */
  description?: string;
  /** Taille */
  size?: CheckboxSize;
  /** Variant visuel */
  variant?: CheckboxVariant;
  /** État indéterminé (tiret) — prioritaire sur checked */
  indeterminate?: boolean;
  /** Message d'erreur */
  error?: string;
  className?: string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    description,
    size = 'md',
    variant = 'default',
    indeterminate = false,
    error,
    className = '',
    id,
    disabled,
    checked,
    ...rest
  },
  ref
) {
  const autoId = useId();
  const checkboxId = id ?? autoId;

  // Injection de l'état indeterminate (non gérable via attribut HTML seul)
  const setRef = (el: HTMLInputElement | null) => {
    if (el) el.indeterminate = indeterminate;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
  };

  const isChecked   = checked || indeterminate;
  const stateClass  = error ? 'fos-cb--error' : '';

  return (
    <div
      className={[
        'fos-cb-wrapper',
        `fos-cb--${size}`,
        `fos-cb--${variant}`,
        stateClass,
        disabled    && 'fos-cb--disabled',
        isChecked   && 'fos-cb--checked',
        indeterminate && 'fos-cb--indeterminate',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <label className="fos-cb__label-wrap" htmlFor={checkboxId}>
        {/* Checkbox visuelle */}
        <span className="fos-cb__control" aria-hidden="true">
          {/* Checkmark SVG */}
          <svg
            className="fos-cb__mark"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {indeterminate ? (
              /* Tiret indeterminate */
              <line
                x1="3" y1="7" x2="11" y2="7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              /* Coche */
              <path
                d="M2.5 7l3.5 3.5 5.5-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </span>

        {/* Input natif caché */}
        <input
          ref={setRef}
          type="checkbox"
          id={checkboxId}
          className="fos-cb__input"
          disabled={disabled}
          checked={checked}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            (description || error) ? `${checkboxId}-desc` : undefined
          }
          {...rest}
        />

        {/* Texte */}
        {(label || description) && (
          <span className="fos-cb__text">
            {label && <span className="fos-cb__label">{label}</span>}
            {description && (
              <span id={`${checkboxId}-desc`} className="fos-cb__description">
                {description}
              </span>
            )}
          </span>
        )}
      </label>

      {/* Erreur */}
      {error && (
        <p
          id={`${checkboxId}-desc`}
          className="fos-cb__error"
          role="alert"
        >
          <ErrorIcon />
          {error}
        </p>
      )}
    </div>
  );
});

// ─── Icône interne ────────────────────────────────────────────────────────────

function ErrorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6 3.5v3M6 8v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
