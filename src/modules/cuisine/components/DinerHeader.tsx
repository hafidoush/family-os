/**
 * FAMILY OS — DinerHeader
 * Bandeau contextuel affiché dans le module Cuisine entre 14h et 21h.
 * Permet de choisir le dîner du soir depuis le planning actif.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';
import { useDebounce } from '@shared/hooks/useDebounce';
import { useDinerAujourdhui } from '../hooks/useDinerAujourdhui';
import { MenuService } from '../services/MenuService';
import type { JourMenu } from '@shared/types';

interface DinerHeaderProps {
  onVoirRecette: (recetteId: string) => void;
}

export function DinerHeader({ onVoirRecette }: DinerHeaderProps) {
  const data = useDinerAujourdhui();
  const [showModal, setShowModal] = useState(false);

  if (data === undefined) return null;

  const { diner, menu, slots, jourAujourdhui, heure } = data;

  // Hors plage d'affichage
  if (heure < 14 || heure >= 21) return null;

  const recettesUtilisees = new Set(
    slots.filter((s) => s.recette).map((s) => s.recette as string)
  );

  const handleChoisir = async (recetteId: string) => {
    const menuActif = menu ?? (await MenuService.getMenuActifOuCreer());
    await MenuService.upsertSlot({
      menuId: menuActif.id,
      jour: jourAujourdhui as JourMenu,
      repas: 'diner',
      recetteId,
    });
    setShowModal(false);
  };

  return (
    <>
      <div className="diner-header">
        {diner ? (
          <div className="diner-header__info">
            <span className="diner-header__label">
              🍽️ Ce soir : <strong>{diner.recetteResolue?.nom ?? diner.descriptionLibre ?? 'Dîner prévu'}</strong>
            </span>
            {heure >= 18 && diner.recetteResolue && (
              <button
                className="diner-header__btn"
                onClick={() => onVoirRecette(diner.recetteResolue!.id)}
              >
                Voir la recette
              </button>
            )}
          </div>
        ) : (
          <button className="diner-header__prompt" onClick={() => setShowModal(true)}>
            Choisissez le repas de ce soir 👇
          </button>
        )}
      </div>

      {showModal && (
        <SelectionDinerModal
          recettesUtilisees={recettesUtilisees}
          onChoisir={handleChoisir}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Modal de sélection ───────────────────────────────────────────────────────

interface SelectionDinerModalProps {
  recettesUtilisees: Set<string>;
  onChoisir: (recetteId: string) => void;
  onClose: () => void;
}

function SelectionDinerModal({ recettesUtilisees, onChoisir, onClose }: SelectionDinerModalProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);

  const recettes = useLiveQuery(
    () =>
      db.recettes
        .filter((r) => {
          if (r.archive || r.deletedAt) return false;
          if (recettesUtilisees.has(r.id)) return false;
          if (!debouncedQuery) return true;
          return r.nom.toLowerCase().includes(debouncedQuery.toLowerCase());
        })
        .toArray()
        .then((list) => list.sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? ''))),
    [debouncedQuery, recettesUtilisees.size]
  );

  return (
    <>
      <div className="diner-modal__overlay" onClick={onClose} />
      <div className="diner-modal">
        <div className="diner-modal__handle" />
        <h3 className="diner-modal__title">Quel repas ce soir ?</h3>

        <input
          className="diner-modal__search"
          placeholder="Rechercher une recette…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {recettes === undefined ? (
          <div className="diner-modal__loading">Chargement…</div>
        ) : recettes.length === 0 ? (
          <div className="diner-modal__empty">
            {debouncedQuery
              ? `Aucun résultat pour "${debouncedQuery}"`
              : 'Toutes les recettes sont déjà utilisées cette semaine'}
          </div>
        ) : (
          <ul className="diner-modal__list">
            {recettes.map((r) => (
              <li key={r.id}>
                <button className="diner-modal__item" onClick={() => onChoisir(r.id)}>
                  <span className="diner-modal__item-nom">{r.nom}</span>
                  {r.tempsPreparation && (
                    <span className="diner-modal__item-temps">⏱ {r.tempsPreparation} min</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button className="diner-modal__cancel" onClick={onClose}>Annuler</button>
      </div>
    </>
  );
}
