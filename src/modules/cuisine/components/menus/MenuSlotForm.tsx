import { useState } from 'react';
import { MenuService } from '../../services/MenuService';
import './MenuSlotForm.css';

interface MenuSlotFormProps {
  menuId: string;
  onClose: () => void;
  recettesDejaUtilisees?: Set<string>;
}

export function MenuSlotForm({ menuId, onClose }: MenuSlotFormProps) {
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await MenuService.addSlot({ menuId, descriptionLibre: description.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="slot-form__overlay" onClick={onClose} />
      <div className="slot-form">
        <div className="slot-form__handle" />
        <h2 className="slot-form__title">Description libre</h2>
        <div className="slot-form__field">
          <input
            className="slot-form__input"
            placeholder="ex : soupe maison, restes du frigo…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>
        <div className="slot-form__actions">
          <button className="slot-form__cancel" onClick={onClose}>Annuler</button>
          <button
            className="slot-form__save"
            onClick={handleSave}
            disabled={!description.trim() || saving}
          >
            {saving ? '…' : 'Ajouter'}
          </button>
        </div>
      </div>
    </>
  );
}
