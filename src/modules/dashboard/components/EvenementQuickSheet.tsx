import { useState, useRef, useEffect } from 'react';
import { db } from '../../../core/db/database';
import { newEntity } from '../../../core/db/helpers';
import type { Evenement, TypeEvenement } from '../../../shared/types';
import './QuickSheet.css';

const TYPE_OPTIONS: { value: TypeEvenement; label: string }[] = [
  { value: 'rendez_vous', label: 'RDV'        },
  { value: 'sortie',      label: 'Sortie'     },
  { value: 'evenement',   label: 'Événement'  },
  { value: 'rappel',      label: 'Rappel'     },
];

interface Props {
  onClose: () => void;
}

export function EvenementQuickSheet({ onClose }: Props) {
  // Date locale "YYYY-MM-DD" (évite le décalage UTC à minuit)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const [titre,  setTitre]  = useState('');
  const [type,   setType]   = useState<TypeEvenement>('rendez_vous');
  const [date,   setDate]   = useState(today);
  const [heure,  setHeure]  = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const canSave = titre.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const dateStr = date + (heure ? `T${heure}:00` : 'T00:00:00');
      await db.evenements.add(newEntity<Evenement>({
        titre:          titre.trim(),
        type,
        dateDebut:      new Date(dateStr),
        journeeEntiere: !heure,
        heureDebut:     heure || undefined,
        archive:        false,
        recurrence:     false,
        contexteMedical: false,
      }));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="quick-sheet-backdrop" onClick={onClose} />
      <div className="quick-sheet" role="dialog" aria-modal aria-label="Ajouter un événement">

        <div className="quick-sheet__handle" />
        <h3 className="quick-sheet__title">Nouvel événement</h3>

        <input
          ref={inputRef}
          className="quick-sheet__input"
          placeholder="Titre de l'événement…"
          value={titre}
          onChange={e => setTitre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />

        <div>
          <p className="quick-sheet__label">Type</p>
          <div className="quick-sheet__pills" style={{ marginTop: 10 }}>
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`quick-sheet__pill${type === opt.value ? ' quick-sheet__pill--active' : ''}`}
                onClick={() => setType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="quick-sheet__row">
          <input
            className="quick-sheet__input quick-sheet__input--date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <input
            className="quick-sheet__input quick-sheet__input--time"
            type="time"
            value={heure}
            onChange={e => setHeure(e.target.value)}
          />
        </div>

        <button
          className="quick-sheet__save"
          onClick={handleSave}
          disabled={!canSave}
        >
          {saving ? 'Enregistrement…' : "Ajouter l'événement"}
        </button>

      </div>
    </>
  );
}
