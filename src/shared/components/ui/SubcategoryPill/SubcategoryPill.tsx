import './SubcategoryPill.css';

interface Props {
  items: { label: string; value: string }[];
  value: string | null;
  onChange: (value: string) => void;
}

export function SubcategoryPill({ items, value, onChange }: Props) {
  return (
    <div className="subcat-row">
      {items.map(item => (
        <button
          key={item.value}
          className={`subcat-pill${item.value === value ? ' subcat-pill--active' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
