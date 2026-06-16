import './SegmentedControl.css';

interface Props {
  items: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ items, value, onChange }: Props) {
  return (
    <div className="seg-control" role="tablist">
      {items.map(item => (
        <button
          key={item.value}
          role="tab"
          aria-selected={item.value === value}
          className={`seg-item${item.value === value ? ' seg-item--active' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
