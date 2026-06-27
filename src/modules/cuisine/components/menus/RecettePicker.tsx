/**
 * FAMILY OS — RecettePicker
 * Sélecteur de recette avec recherche.
 * S'affiche en overlay par-dessus le MenuSlotForm.
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';
import { useDebounce } from '@shared/hooks/useDebounce';
import { IconHeart } from '@shared/components/ui/Icon/Icon';
import './RecettePicker.css';

interface RecettePickerProps {
  onSelect: (recetteId: string, nom: string) => void;
  onClose: () => void;
  recettesDejaUtilisees?: Set<string>;
}

export function RecettePicker({ onSelect, onClose, recettesDejaUtilisees }: RecettePickerProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);

  const recettes = useLiveQuery(
    () =>
      db.recettes
        .filter((r) => {
          if (r.archive || r.deletedAt) return false;
          if (!debouncedQuery) return true;
          return r.nom.toLowerCase().includes(debouncedQuery.toLowerCase());
        })
        .toArray()
        .then((list) => list.sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? ""))),
    [debouncedQuery]
  );

  return (
    <>
      <div className="recette-picker__overlay" onClick={onClose} />
      <div className="recette-picker">
        <div className="recette-picker__handle" />
        <div className="recette-picker__header">
          <h3 className="recette-picker__title">Choisir une recette</h3>
          <button className="recette-picker__close" onClick={onClose}>×</button>
        </div>

        <input
          className="recette-picker__search"
          placeholder="Rechercher…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {recettes === undefined ? (
          <div className="recette-picker__loading">Chargement…</div>
        ) : recettes.length === 0 ? (
          <div className="recette-picker__empty">
            {debouncedQuery ? `Aucun résultat pour "${debouncedQuery}"` : 'Aucune recette'}
          </div>
        ) : (
          <ul className="recette-picker__list">
            {recettes.map((r) => {
              const dejaUtilisee = recettesDejaUtilisees?.has(r.id) ?? false;
              return (
                <li key={r.id}>
                  <button
                    className={`recette-picker__item ${dejaUtilisee ? 'recette-picker__item--used' : ''}`}
                    onClick={() => onSelect(r.id, r.nom)}
                    disabled={dejaUtilisee}
                    title={dejaUtilisee ? 'Déjà utilisée cette semaine' : undefined}
                  >
                    {r.image && (
                      <div className="recette-picker__thumb">
                        <img
                          src={URL.createObjectURL(r.image)}
                          alt={r.nom}
                        />
                      </div>
                    )}
                    <div className="recette-picker__info">
                      <span className="recette-picker__nom">{r.nom}</span>
                      {r.tempsPreparation && (
                        <span className="recette-picker__temps">
                          ⏱ {r.tempsPreparation} min
                        </span>
                      )}
                      {dejaUtilisee && (
                        <span className="recette-picker__used-label">Déjà au menu</span>
                      )}
                    </div>
                    {r.favori && <span className="recette-picker__favori"><IconHeart size={14} /></span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
