import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  iconLeft?:  ReactNode;
  iconRight?: ReactNode;
  iconOnly?:  boolean;
  loading?:   boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant   = 'primary',
      size      = 'md',
      iconLeft,
      iconRight,
      iconOnly  = false,
      loading   = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const cls = [
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      iconOnly  && 'btn--icon-only',
      fullWidth && 'btn--full',
      loading   && 'btn--loading',
      className,
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={cls}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...rest}
      >
        {loading && <span className="btn__spinner" aria-hidden="true" />}
        <span className={`btn__content${loading ? ' btn__content--hidden' : ''}`}>
          {iconLeft  && <span className="btn__icon" aria-hidden="true">{iconLeft}</span>}
          {!iconOnly && children && <span className="btn__label">{children}</span>}
          {iconOnly  && children && <span className="sr-only">{children}</span>}
          {iconRight && <span className="btn__icon" aria-hidden="true">{iconRight}</span>}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export default Button;
