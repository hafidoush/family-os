/**
 * FAMILY OS — MenuSlotForm
 * Drawer bottom sheet pour ajouter une recette à un menu.
 * - Sélection recette via RecettePicker
 * - Jour optionnel (défaut : aucun)
 * - Repas optionnel (défaut : aucun)
 */
import { useState } from 'react';
import { RecettePicker } from './RecettePicker';
import { MenuService } from '../../services/MenuService';
import type { JourMenu, RepasMenu } from '@shared/types';
import './MenuSlotForm.css';

const JOURS: { value: JourMenu; label: string }[] = [
  { value: 'lundi',    label: 'Lundi' },
  { value: 'mardi',    label: 'Mardi' },
  { value: 'mercredi', label: 'Mercredi' },
  { value: 'jeudi',    label: 'Jeudi' },
  { value: 'vendredi', label: 'Vendredi' },
  { value: 'samedi',   label: 'Samedi' },
  { value: 'dimanche', label: 'Dimanche' },
];

const REPAS: { value: RepasMenu; label: string; icon: string }[] = [
  { value: 'petit_dejeuner', label: 'Petit-déj',  icon: '🥐' },
  { value: 'dejeuner',       label: 'Déjeuner',   icon: '☀️' },
  { value: 'collation',      label: 'Collation',  icon: '🍎' },
  { value: 'diner',          label: 'Dîner',      icon: '🌙' },
];

interface MenuSlotFormProps {
  menuId: string;
  onClose: () => void;
  recettesDejaUtilisees?: Set<string>;
}

export function MenuSlotForm({ menuId, onClose, recettesDejaUtilisees }: MenuSlotFormProps) {
  const [recetteId, setRecetteId] = useState<string | undefined>();
  const [recetteNom, setRecetteNom] = useState<string>('');
  const [descriptionLibre, setDescriptionLibre] = useState('');
  const [jour, setJour] = useState<JourMenu | undefined>(undefined);
  const [repas, setRepas] = useState<RepasMenu | undefined>(undefined);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = !!recetteId || descriptionLibre.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await MenuService.addSlot({
        menuId,
        recetteId,
        descriptionLibre: recetteId ? undefined : descriptionLibre.trim(),
        jour,
        repas,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="slot-form__overlay" onClick={onClose} />

      {/* Sheet */}
      <div className="slot-form">
        <div className="slot-form__handle" />

        <h2 className="slot-form__title">Ajouter une recette</h2>

        {/* Sélection recette */}
        <div className="slot-form__field">
          <label className="slot-form__label">Recette</label>
          {recetteId ? (
            <div className="slot-form__recette-selected">
              <span>{recetteNom}</span>
              <button
                className="slot-form__recette-clear"
                onClick={() => { setRecetteId(undefined); setRecetteNom(''); }}
              >×</button>
            </div>
          ) : (
            <>
              <button
                className="slot-form__pick-btn"
                onClick={() => setShowPicker(true)}
              >
                Choisir dans mes recettes…
              </button>
              <div className="slot-form__separator">ou</div>
              <input
                className="slot-form__input"
                placeholder="Nom libre (ex : soupe maison)"
                value={descriptionLibre}
                onChange={(e) => setDescriptionLibre(e.target.value)}
              />
            </>
          )}
        </div>

        {/* Jour — optionnel */}
        <div className="slot-form__field">
          <label className="slot-form__label">
            Jour <span className="slot-form__optional">(optionnel)</span>
          </label>
          <div className="slot-form__jours">
            <button
              className={`slot-form__jour-btn ${jour === undefined ? 'slot-form__jour-btn--active' : ''}`}
              onClick={() => setJour(undefined)}
            >
              Libre
            </button>
            {JOURS.map((j) => (
              <button
                key={j.value}
                className={`slot-form__jour-btn ${jour === j.value ? 'slot-form__jour-btn--active' : ''}`}
                onClick={() => setJour(jour === j.value ? undefined : j.value)}
              >
                {j.label.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Repas — optionnel */}
        <div className="slot-form__field">
          <label className="slot-form__label">
            Repas <span className="slot-form__optional">(optionnel)</span>
          </label>
          <div className="slot-form__repas">
            {REPAS.map((r) => (
              <button
                key={r.value}
                className={`slot-form__repas-btn ${repas === r.value ? 'slot-form__repas-btn--active' : ''}`}
                onClick={() => setRepas(repas === r.value ? undefined : r.value)}
              >
                <span>{r.icon}</span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="slot-form__actions">
          <button className="slot-form__cancel" onClick={onClose}>
            Annuler
          </button>
          <button
            className="slot-form__save"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </div>

      {/* RecettePicker */}
      {showPicker && (
        <RecettePicker
          onSelect={(id, nom) => {
            setRecetteId(id);
            setRecetteNom(nom);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
          recettesDejaUtilisees={recettesDejaUtilisees}
        />
      )}
    </>
  );
}
