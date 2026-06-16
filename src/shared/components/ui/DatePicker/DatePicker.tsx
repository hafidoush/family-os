/**
 * FAMILY OS — DatePicker Component
 * Sélecteur de date avec calendrier custom.
 * - Mode date seule ou date + heure
 * - Navigation mois par mois
 * - Highlight : aujourd'hui, date sélectionnée, plage désactivée
 * - Keyboard-navigable, accessible
 * - Fermeture au clic extérieur et Escape
 */

import React, {
  forwardRef,
  useId,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  isAfter,
  isValid,
  parse,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import './DatePicker.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DatePickerSize = 'sm' | 'md' | 'lg';
export type DatePickerVariant = 'default' | 'filled' | 'ghost';

export interface DatePickerProps {
  /** Valeur courante */
  value?: Date | null;
  /** Callback à chaque changement */
  onChange?: (date: Date | null) => void;
  /** Label au-dessus du champ */
  label?: string;
  /** Placeholder affiché quand aucune date */
  placeholder?: string;
  /** Activer la sélection de l'heure */
  withTime?: boolean;
  /** Date minimale sélectionnable */
  minDate?: Date;
  /** Date maximale sélectionnable */
  maxDate?: Date;
  /** Taille */
  size?: DatePickerSize;
  /** Variant visuel */
  variant?: DatePickerVariant;
  /** Message d'erreur */
  error?: string;
  /** Message de succès */
  success?: string;
  /** Texte d'aide */
  hint?: string;
  /** Désactivé */
  disabled?: boolean;
  /** Permettre de vider la valeur */
  clearable?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DAYS_FR = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
const DATE_FORMAT = 'dd/MM/yyyy';
const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCalendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  let current = start;
  while (!isAfter(current, end)) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// ─── Composant ────────────────────────────────────────────────────────────────

export const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(function DatePicker(
  {
    value,
    onChange,
    label,
    placeholder = 'Sélectionner une date',
    withTime = false,
    minDate,
    maxDate,
    size = 'md',
    variant = 'default',
    error,
    success,
    hint,
    disabled = false,
    clearable = true,
    id,
    className = '',
    'aria-label': ariaLabel,
  },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(value ?? new Date());
  const [focusedDay, setFocusedDay] = useState<Date | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const state = error ? 'error' : success ? 'success' : 'normal';
  const helperText = error || success || hint;
  const helperRole = error ? 'error' : success ? 'success' : 'hint';

  const displayFormat = withTime ? DATETIME_FORMAT : DATE_FORMAT;
  const displayValue = value && isValid(value) ? format(value, displayFormat, { locale: fr }) : '';

  // Sync du mois affiché quand la valeur change extérieurement
  useEffect(() => {
    if (value && isValid(value)) setViewMonth(value);
  }, [value]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Fermeture Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const days = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);

  const isDayDisabled = useCallback(
    (day: Date) => {
      if (minDate && isBefore(day, minDate) && !isSameDay(day, minDate)) return true;
      if (maxDate && isAfter(day, maxDate) && !isSameDay(day, maxDate)) return true;
      return false;
    },
    [minDate, maxDate]
  );

  const handleDayClick = useCallback(
    (day: Date) => {
      if (isDayDisabled(day)) return;
      let next = day;
      if (withTime && value) {
        next = setHours(setMinutes(day, getMinutes(value)), getHours(value));
      }
      onChange?.(next);
      if (!withTime) setOpen(false);
    },
    [isDayDisabled, onChange, withTime, value]
  );

  const handleHourChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const h = clamp(parseInt(e.target.value, 10) || 0, 0, 23);
      const base = value ?? new Date();
      onChange?.(setHours(base, h));
    },
    [onChange, value]
  );

  const handleMinuteChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const m = clamp(parseInt(e.target.value, 10) || 0, 0, 59);
      const base = value ?? new Date();
      onChange?.(setMinutes(base, m));
    },
    [onChange, value]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.(null);
    },
    [onChange]
  );

  const handlePrevMonth = () => setViewMonth((m) => subMonths(m, 1));
  const handleNextMonth = () => setViewMonth((m) => addMonths(m, 1));

  // Keyboard navigation dans le calendrier
  const handleCalendarKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const pivot = focusedDay ?? value ?? new Date();
      let next: Date | null = null;
      if (e.key === 'ArrowRight') next = addDays(pivot, 1);
      if (e.key === 'ArrowLeft')  next = addDays(pivot, -1);
      if (e.key === 'ArrowDown')  next = addDays(pivot, 7);
      if (e.key === 'ArrowUp')    next = addDays(pivot, -7);
      if (next) {
        e.preventDefault();
        setFocusedDay(next);
        if (!isSameMonth(next, viewMonth)) setViewMonth(startOfMonth(next));
      }
      if (e.key === 'Enter' && focusedDay) handleDayClick(focusedDay);
    },
    [focusedDay, value, viewMonth, handleDayClick]
  );

  return (
    <div
      ref={(node) => {
        (wrapperRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={[
        'fos-dp-wrapper',
        `fos-dp--${size}`,
        `fos-dp--${variant}`,
        `fos-dp--${state}`,
        open && 'fos-dp--open',
        disabled && 'fos-dp--disabled',
        !displayValue && 'fos-dp--empty',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Label */}
      {label && (
        <label className="fos-dp__label" htmlFor={inputId}>
          {label}
        </label>
      )}

      {/* Trigger */}
      <div className="fos-dp__field-wrap">
        <button
          ref={triggerRef}
          type="button"
          id={inputId}
          className="fos-dp__trigger"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel ?? label ?? placeholder}
          aria-describedby={helperText ? `${inputId}-helper` : undefined}
          aria-invalid={state === 'error' ? 'true' : undefined}
        >
          <span className="fos-dp__calendar-icon" aria-hidden="true">
            <CalendarIcon />
          </span>
          <span className={`fos-dp__value ${!displayValue ? 'fos-dp__value--placeholder' : ''}`}>
            {displayValue || placeholder}
          </span>
          {clearable && displayValue && (
            <span
              className="fos-dp__clear"
              onClick={handleClear}
              role="button"
              tabIndex={0}
              aria-label="Effacer la date"
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as any)}
            >
              <ClearIcon />
            </span>
          )}
          {(!clearable || !displayValue) && (
            <span className="fos-dp__chevron" aria-hidden="true">
              <ChevronIcon />
            </span>
          )}
        </button>
      </div>

      {/* Helper */}
      {helperText && (
        <p
          id={`${inputId}-helper`}
          className={`fos-dp__helper fos-dp__helper--${helperRole}`}
          role={state === 'error' ? 'alert' : undefined}
        >
          {state === 'error' && <ErrorIcon />}
          {state === 'success' && <SuccessIcon />}
          {helperText}
        </p>
      )}

      {/* Popover calendrier */}
      {open && (
        <div
          ref={calendarRef}
          className="fos-dp__popover"
          role="dialog"
          aria-label="Calendrier"
          aria-modal="true"
          onKeyDown={handleCalendarKeyDown}
        >
          {/* Header navigation mois */}
          <div className="fos-dp__nav">
            <button
              type="button"
              className="fos-dp__nav-btn"
              onClick={handlePrevMonth}
              aria-label="Mois précédent"
            >
              <ChevronLeftIcon />
            </button>
            <span className="fos-dp__month-label">
              {format(viewMonth, 'MMMM yyyy', { locale: fr })}
            </span>
            <button
              type="button"
              className="fos-dp__nav-btn"
              onClick={handleNextMonth}
              aria-label="Mois suivant"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* En-têtes des jours */}
          <div className="fos-dp__grid" role="grid" aria-label={format(viewMonth, 'MMMM yyyy', { locale: fr })}>
            {DAYS_FR.map((d) => (
              <div key={d} className="fos-dp__day-header" role="columnheader" aria-label={d}>
                {d}
              </div>
            ))}

            {/* Jours */}
            {days.map((day) => {
              const outside   = !isSameMonth(day, viewMonth);
              const selected  = value ? isSameDay(day, value) : false;
              const today     = isToday(day);
              const disabled  = isDayDisabled(day);
              const focused   = focusedDay ? isSameDay(day, focusedDay) : false;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  role="gridcell"
                  tabIndex={focused || (selected && !focusedDay) ? 0 : -1}
                  className={[
                    'fos-dp__day',
                    outside   && 'fos-dp__day--outside',
                    selected  && 'fos-dp__day--selected',
                    today     && 'fos-dp__day--today',
                    disabled  && 'fos-dp__day--disabled',
                    focused   && 'fos-dp__day--focused',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleDayClick(day)}
                  aria-pressed={selected}
                  aria-disabled={disabled}
                  aria-label={format(day, 'EEEE d MMMM yyyy', { locale: fr })}
                >
                  <span className="fos-dp__day-inner">{format(day, 'd')}</span>
                  {today && !selected && <span className="fos-dp__today-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {/* Sélecteur heure */}
          {withTime && (
            <div className="fos-dp__time">
              <span className="fos-dp__time-label">Heure</span>
              <div className="fos-dp__time-inputs">
                <input
                  type="number"
                  className="fos-dp__time-input"
                  value={value ? String(getHours(value)).padStart(2, '0') : '00'}
                  onChange={handleHourChange}
                  min={0}
                  max={23}
                  aria-label="Heure"
                />
                <span className="fos-dp__time-sep">:</span>
                <input
                  type="number"
                  className="fos-dp__time-input"
                  value={value ? String(getMinutes(value)).padStart(2, '0') : '00'}
                  onChange={handleMinuteChange}
                  min={0}
                  max={59}
                  aria-label="Minutes"
                />
              </div>
              <button
                type="button"
                className="fos-dp__time-confirm"
                onClick={() => setOpen(false)}
              >
                Confirmer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─── Icônes internes ──────────────────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="5.5" cy="9.5" r="0.8" fill="currentColor"/>
      <circle cx="8" cy="9.5" r="0.8" fill="currentColor"/>
      <circle cx="10.5" cy="9.5" r="0.8" fill="currentColor"/>
      <circle cx="5.5" cy="12" r="0.8" fill="currentColor"/>
      <circle cx="8" cy="12" r="0.8" fill="currentColor"/>
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6 3.5v3M6 8v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3.5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
