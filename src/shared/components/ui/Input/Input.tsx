/**
 * FAMILY OS — Input Component
 * Composant input universel du design system.
 * Variants : default | filled | ghost
 * Tailles : sm | md | lg
 * États : normal | focus | error | success | disabled
 */

import React, { forwardRef, useId, useState } from 'react';
import './Input.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputSize = 'sm' | 'md' | 'lg';
export type InputVariant = 'default' | 'filled' | 'ghost';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Label affiché au-dessus de l'input */
  label?: string;
  /** Taille du composant */
  size?: InputSize;
  /** Variant visuel */
  variant?: InputVariant;
  /** Icône à gauche (élément React — ex. SVG ou emoji) */
  leftIcon?: React.ReactNode;
  /** Icône ou action à droite */
  rightIcon?: React.ReactNode;
  /** Message d'erreur — active l'état error */
  error?: string;
  /** Message de succès — active l'état success */
  success?: string;
  /** Texte d'aide sous l'input (affiché si pas d'error ni success) */
  hint?: string;
  /** Affiche un indicateur de chargement à droite */
  loading?: boolean;
  /** Remplace entièrement le conteneur (pour compositions avancées) */
  className?: string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    size = 'md',
    variant = 'default',
    leftIcon,
    rightIcon,
    error,
    success,
    hint,
    loading = false,
    className = '',
    id,
    disabled,
    onFocus,
    onBlur,
    ...rest
  },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [focused, setFocused] = useState(false);

  const state = error ? 'error' : success ? 'success' : 'normal';
  const hasLeftIcon = Boolean(leftIcon);
  const hasRightContent = Boolean(rightIcon) || loading;

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    onBlur?.(e);
  };

  const helperText = error || success || hint;
  const helperRole = error ? 'error' : success ? 'success' : 'hint';

  return (
    <div
      className={[
        'fos-input-wrapper',
        `fos-input--${size}`,
        `fos-input--${variant}`,
        `fos-input--${state}`,
        focused && 'fos-input--focused',
        disabled && 'fos-input--disabled',
        hasLeftIcon && 'fos-input--has-left',
        hasRightContent && 'fos-input--has-right',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Label */}
      {label && (
        <label className="fos-input__label" htmlFor={inputId}>
          {label}
        </label>
      )}

      {/* Field */}
      <div className="fos-input__field-wrap">
        {/* Icône gauche */}
        {hasLeftIcon && (
          <span className="fos-input__icon fos-input__icon--left" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Input natif */}
        <input
          ref={ref}
          id={inputId}
          className="fos-input__field"
          disabled={disabled}
          aria-invalid={state === 'error' ? 'true' : undefined}
          aria-describedby={helperText ? `${inputId}-helper` : undefined}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />

        {/* Icône droite / loader */}
        {hasRightContent && (
          <span className="fos-input__icon fos-input__icon--right" aria-hidden="true">
            {loading ? <LoadingSpinner /> : rightIcon}
          </span>
        )}

        {/* Bordure focus animée */}
        <span className="fos-input__focus-ring" aria-hidden="true" />
      </div>

      {/* Helper text */}
      {helperText && (
        <p
          id={`${inputId}-helper`}
          className={`fos-input__helper fos-input__helper--${helperRole}`}
          role={state === 'error' ? 'alert' : undefined}
        >
          {state === 'error' && <ErrorIcon />}
          {state === 'success' && <SuccessIcon />}
          {helperText}
        </p>
      )}
    </div>
  );
});

// ─── Sous-composants internes ─────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <svg className="fos-input__spinner" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeDasharray="28" strokeDashoffset="10" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 3.5v3M6 8v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
