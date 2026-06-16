import './Toggle.css';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <label className="toggle-wrap">
      <button
        role="switch"
        aria-checked={checked}
        className={`toggle${checked ? ' toggle--on' : ' toggle--off'}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
      />
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}
