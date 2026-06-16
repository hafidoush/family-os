/**
 * FAMILY OS — Select Component
 * Dropdown de sélection unique.
 * Partage la même API visuelle que Input (label, hint, error, success, sizes, variants).
 * Composant natif <select> enrichi — accessible, fonctionnel hors ligne, iOS-friendly.
 */

import React, { forwardRef, useId } from 'react';
import './Select.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SelectSize = 'sm' | 'md' | 'lg';
export type SelectVariant = 'default' | 'filled' | 'ghost';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

export type SelectItem = SelectOption | SelectGroup;

function isGroup(item: SelectItem): item is SelectGroup {
  return 'options' in item;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Options plates ou groupées */
  items?: SelectItem[];
  /** Alias de items pour compatibilité avec les composants existants */
  options?: SelectOption[];
  /** Label affiché au-dessus */
  label?: string;
  /** Taille du composant */
  size?: SelectSize;
  /** Variant visuel */
  variant?: SelectVariant;
  /** Icône à gauche */
  leftIcon?: React.ReactNode;
  /** Texte du placeholder (option vide désactivée) */
  placeholder?: string;
  /** Message d'erreur */
  error?: string;
  /** Message de succès */
  success?: string;
  /** Texte d'aide */
  hint?: string;
  className?: string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    items: itemsProp,
    options,
    label,
    size = 'md',
    variant = 'default',
    leftIcon,
    placeholder,
    error,
    success,
    hint,
    className = '',
    id,
    disabled,
    value,
    ...rest
  },
  ref
) {
  const items = itemsProp ?? options ?? [];
  const autoId = useId();
  const selectId = id ?? autoId;

  const state = error ? 'error' : success ? 'success' : 'normal';
  const hasLeftIcon = Boolean(leftIcon);
  const helperText = error || success || hint;
  const helperRole = error ? 'error' : success ? 'success' : 'hint';

  // Détermine si la valeur courante est le placeholder
  const isPlaceholderSelected = !value || value === '';

  return (
    <div
      className={[
        'fos-select-wrapper',
        `fos-select--${size}`,
        `fos-select--${variant}`,
        `fos-select--${state}`,
        disabled && 'fos-select--disabled',
        hasLeftIcon && 'fos-select--has-left',
        isPlaceholderSelected && 'fos-select--placeholder',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Label */}
      {label && (
        <label className="fos-select__label" htmlFor={selectId}>
          {label}
        </label>
      )}

      {/* Field */}
      <div className="fos-select__field-wrap">
        {/* Icône gauche */}
        {hasLeftIcon && (
          <span className="fos-select__icon fos-select__icon--left" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Select natif */}
        <select
          ref={ref}
          id={selectId}
          className="fos-select__field"
          disabled={disabled}
          value={value}
          aria-invalid={state === 'error' ? 'true' : undefined}
          aria-describedby={helperText ? `${selectId}-helper` : undefined}
          {...rest}
        >
          {/* Placeholder option */}
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}

          {/* Options */}
          {items.map((item, i) =>
            isGroup(item) ? (
              <optgroup key={i} label={item.label}>
                {item.options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option key={item.value} value={item.value} disabled={item.disabled}>
                {item.label}
              </option>
            )
          )}
        </select>

        {/* Chevron custom */}
        <span className="fos-select__chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      </div>

      {/* Helper text */}
      {helperText && (
        <p
          id={`${selectId}-helper`}
          className={`fos-select__helper fos-select__helper--${helperRole}`}
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

// ─── Icônes internes ──────────────────────────────────────────────────────────

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
