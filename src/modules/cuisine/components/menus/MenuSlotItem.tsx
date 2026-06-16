/**
 * FAMILY OS — MenuSlotItem
 * Une recette dans la liste du menu.
 * Affiche nom, jour (optionnel), repas (optionnel), statut.
 */
import { useState } from 'react';
import type { JourMenu, RepasMenu } from '@shared/types';
import './MenuSlotItem.css';

const JOURS_LABELS: Record<JourMenu, string> = {
  lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer',
  jeudi: 'Jeu', vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
};

const REPAS_LABELS: Record<RepasMenu, string> = {
  petit_dejeuner: 'Petit-déj',
  dejeuner: 'Déjeuner',
  collation: 'Collation',
  diner: 'Dîner',
};

interface SlotResolu {
  id: string;
  jour?: JourMenu;
  repas?: RepasMenu;
  statut?: 'prevue' | 'realisee';
  descriptionLibre?: string;
  recetteResolue?: { id: string; nom: string; image?: Blob };
}

interface MenuSlotItemProps {
  slot: SlotResolu;
  showJour?: boolean;
  onToggleRealise: () => void;
  onRemove: () => void;
}

export function MenuSlotItem({
  slot,
  showJour = true,
  onToggleRealise,
  onRemove,
}: MenuSlotItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nom = slot.recetteResolue?.nom ?? slot.descriptionLibre ?? 'Recette';
  const realise = slot.statut === 'realisee';

  const handleRemoveClick = () => {
    if (confirmDelete) {
      onRemove();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <li className={`menu-slot-item ${realise ? 'menu-slot-item--realise' : ''}`}>
      {/* Checkbox réalisé */}
      <button
        className="menu-slot-item__check"
        onClick={onToggleRealise}
        aria-label={realise ? 'Marquer comme prévu' : 'Marquer comme réalisé'}
      >
        {realise ? '✓' : ''}
      </button>

      {/* Infos */}
      <div className="menu-slot-item__body">
        <span className="menu-slot-item__nom">{nom}</span>
        <div className="menu-slot-item__meta">
          {showJour && slot.jour && (
            <span className="menu-slot-item__tag">{JOURS_LABELS[slot.jour]}</span>
          )}
          {slot.repas && (
            <span className="menu-slot-item__tag menu-slot-item__tag--repas">
              {REPAS_LABELS[slot.repas]}
            </span>
          )}
        </div>
      </div>

      {/* Miniature recette */}
      {slot.recetteResolue?.image && (
        <div className="menu-slot-item__thumb">
          <img
            src={URL.createObjectURL(slot.recetteResolue.image)}
            alt={nom}
          />
        </div>
      )}

      {/* Supprimer */}
      <button
        className={`menu-slot-item__delete ${confirmDelete ? 'menu-slot-item__delete--confirm' : ''}`}
        onClick={handleRemoveClick}
        aria-label="Supprimer"
      >
        {confirmDelete ? '?' : '×'}
      </button>
    </li>
  );
}
