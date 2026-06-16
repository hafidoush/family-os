import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { newEntity } from '../../../core/db/helpers';
import type { Activite, PlanificationActivite } from '../../../shared/types';
import './QuickSheet.css';

interface EnfantAvecPrenom {
  id: string;
  prenom: string;
  couleur?: string;
}

interface Props {
  onClose: () => void;
}

export function ActiviteQuickSheet({ onClose }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const enfants = useLiveQuery<EnfantAvecPrenom[]>(async () => {
    const all = await db.enfants.toArray();
    const membres = await db.membres.toArray();
    const membreMap = new Map(membres.map(m => [m.id, m]));
    return all
      .filter(e => !e.deletedAt)
      .map(e => ({
        id:      e.id,
        prenom:  membreMap.get(e.id)?.prenom ?? '?',
        couleur: membreMap.get(e.id)?.couleur,
      }));
  }, []);

  const [enfantId,     setEnfantId]     = useState('');
  const [nomActivite,  setNomActivite]  = useState('');
  const [date,         setDate]         = useState(today);
  const [heure,        setHeure]        = useState('');
  const [saving,       setSaving]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-sélection si un seul enfant
  useEffect(() => {
    if (enfants?.length === 1) setEnfantId(enfants[0].id);
  }, [enfants]);

  const canSave = nomActivite.trim().length > 0 && enfantId.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const activite = newEntity<Activite>({
        nom:                nomActivite.trim(),
        categorie:          'libre',
        statutBibliotheque: 'a_faire',
        archive:            false,
      });
      await db.activites.add(activite);

      await db.planificationsActivites.add(newEntity<PlanificationActivite>({
        activite:   activite.id,
        enfant:     enfantId,
        datePrevue: date,
        heurePrevue: heure || undefined,
        statut:     'planifiee',
      }));

      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="quick-sheet-backdrop" onClick={onClose} />
      <div className="quick-sheet" role="dialog" aria-modal aria-label="Planifier une activité">

        <div className="quick-sheet__handle" />
        <h3 className="quick-sheet__title">Planifier une activité</h3>

        {/* Sélection enfant */}
        {!enfants ? (
          <p className="quick-sheet__loading">Chargement…</p>
        ) : enfants.length === 0 ? (
          <p className="quick-sheet__empty">Aucun enfant enregistré dans le profil.</p>
        ) : (
          <div>
            <p className="quick-sheet__label">Pour qui ?</p>
            <div className="quick-sheet__pills" style={{ marginTop: 10 }}>
              {enfants.map(e => (
                <button
                  key={e.id}
                  className={`quick-sheet__pill${enfantId === e.id ? ' quick-sheet__pill--active' : ''}`}
                  onClick={() => setEnfantId(e.id)}
                >
                  {e.prenom}
                </button>
              ))}
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          className="quick-sheet__input"
          placeholder="Nom de l'activité…"
          value={nomActivite}
          onChange={e => setNomActivite(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />

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
          {saving ? 'Enregistrement…' : "Planifier l'activité"}
        </button>

      </div>
    </>
  );
}
