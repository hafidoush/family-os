import { useState, useCallback } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import { useFamilyHumeurs } from '../hooks/useFamilyHumeurs';
import { db } from '../../../core/db/database';
import { newEntity } from '../../../core/db/helpers';
import type { Humeur, ValeurHumeur } from '../../../shared/types';
import { emit } from '../../../core/automation/engine';
import './HumeurSaisieSheet.css';

const HUMEUR_OPTIONS = [
  { valeur: 1, emoji: '😔', label: 'Triste' },
  { valeur: 2, emoji: '😕', label: 'Pas bien' },
  { valeur: 3, emoji: '😐', label: 'Neutre' },
  { valeur: 4, emoji: '🙂', label: 'Bien' },
  { valeur: 5, emoji: '😊', label: 'Heureux' },
  { valeur: 6, emoji: '😄', label: 'Super' },
  { valeur: 7, emoji: '🤩', label: 'Excellent' },
];

export function HumeurSaisieSheet() {
  const { activeSheet, humeurTargetMembreId, closeSheet } = useDashboardStore();
  const humeurs = useFamilyHumeurs();
  const [note, setNote] = useState('');
  const [valeurSelectionnee, setValeurSelectionnee] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const membre = humeurs?.find((h) => h.membre.id === humeurTargetMembreId)?.membre;

  const handleConfirm = useCallback(async () => {
    if (!humeurTargetMembreId || valeurSelectionnee === null || saving) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const existing = await db.humeurs
        .where({ membre: humeurTargetMembreId, date: today })
        .first();
      if (existing) {
        await db.humeurs.update(existing.id, {
          valeur: valeurSelectionnee as ValeurHumeur,
          noteLibre: note.trim() || undefined,
          updatedAt: new Date(),
        });
      } else {
        const humeur = newEntity<Humeur>({
          membre: humeurTargetMembreId,
          date: today,
          valeur: valeurSelectionnee as ValeurHumeur,
          noteLibre: note.trim() || undefined,
          source: 'saisie_rapide',
        });
        await db.humeurs.add(humeur);
      }
      setNote('');
      setValeurSelectionnee(null);
      closeSheet();
      emit('humeur.created', { membreId: humeurTargetMembreId, valeur: valeurSelectionnee });
    } finally {
      setSaving(false);
    }
  }, [humeurTargetMembreId, valeurSelectionnee, note, saving, closeSheet]);

  const handleCancel = useCallback(() => {
    setNote('');
    setValeurSelectionnee(null);
    closeSheet();
  }, [closeSheet]);

  if (activeSheet !== 'humeur') return null;

  return (
    <>
      <div className="humeur-sheet__backdrop" onClick={handleCancel} />
      <div className="humeur-sheet" role="dialog" aria-modal>
        <div className="humeur-sheet__handle" />
        <p className="humeur-sheet__title">
          Comment va{' '}
          <strong>{membre?.prenom ?? '…'}</strong> aujourd'hui ?
        </p>

        {/* Sélection de l'emoji */}
        <div className="humeur-sheet__options">
          {HUMEUR_OPTIONS.map((opt) => (
            <button
              key={opt.valeur}
              className={`humeur-sheet__option${valeurSelectionnee === opt.valeur ? ' humeur-sheet__option--selected' : ''}`}
              onClick={() => setValeurSelectionnee(opt.valeur)}
              disabled={saving}
            >
              <span className="humeur-sheet__option-emoji">{opt.emoji}</span>
              <span className="humeur-sheet__option-label">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Note facultative */}
        <textarea
          className="humeur-sheet__note"
          placeholder="Une note ? (facultatif)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={200}
        />

        {/* Boutons d'action */}
        <div className="humeur-sheet__actions">
          <button className="humeur-sheet__cancel" onClick={handleCancel}>
            Annuler
          </button>
          <button
            className="humeur-sheet__confirm"
            onClick={handleConfirm}
            disabled={valeurSelectionnee === null || saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </>
  );
}
