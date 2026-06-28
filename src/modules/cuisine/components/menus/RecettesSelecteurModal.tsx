import { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../core/db/database';
import { MenuService } from '../../services/MenuService';
import type { Recette, CategorieRecette } from '../../../../shared/types';
import './RecettesSelecteurModal.css';

const TAGS_RECETTES = [
  { id: 'française',      label: 'Française' },
  { id: 'italienne',      label: 'Italienne' },
  { id: 'espagnole',      label: 'Espagnole' },
  { id: 'grecque',        label: 'Grecque' },
  { id: 'marocaine',      label: 'Marocaine' },
  { id: 'asiatique',      label: 'Asiatique' },
  { id: 'indienne',       label: 'Indienne' },
  { id: 'fast-food',      label: 'Fast-food' },
  { id: 'mexicaine',      label: 'Mexicaine' },
  { id: 'réception',      label: 'Réception' },
  { id: 'batch cooking',  label: 'Batch cooking' },
  { id: 'ramadan',        label: 'Ramadan' },
  { id: 'enfant',         label: 'Enfant' },
  { id: 'réconfortant',   label: 'Réconfortant' },
  { id: 'frais & léger',  label: 'Frais & léger' },
  { id: 'apéro',          label: 'Apéro' },
  { id: 'pizza & tartes', label: 'Pizza & tartes' },
] as const;

function RecetteThumb({ recette, categorie, added, onSelect }: {
  recette: Recette
  categorie?: CategorieRecette
  added: boolean
  onSelect: (id: string) => void
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (recette.imageData) { setImageUrl(recette.imageData); return; }
    if (!recette.image) { setImageUrl(null); return; }
    const url = URL.createObjectURL(recette.image);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recette.imageData, recette.image]);

  return (
    <button
      className={`rsel__thumb${added ? ' rsel__thumb--added' : ''}`}
      onClick={() => !added && onSelect(recette.id)}
      disabled={added}
    >
      {imageUrl
        ? <img src={imageUrl} alt={recette.nom} loading="lazy" />
        : <div className="rsel__thumb-placeholder">🍽️</div>
      }
      <div className="rsel__thumb-glass" />
      {added && (
        <div className="rsel__thumb-check">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <div className="rsel__thumb-footer">
        {categorie && <span className="rsel__thumb-cat">{categorie.nom}</span>}
        <span className="rsel__thumb-nom">{recette.nom}</span>
      </div>
    </button>
  );
}

interface Props {
  menuId: string;
  onClose: () => void;
  dejaDansLeMenu?: Set<string>;
}

export function RecettesSelecteurModal({ menuId, onClose, dejaDansLeMenu }: Props) {
  const [added, setAdded] = useState<Set<string>>(dejaDansLeMenu ?? new Set());
  const [recherche, setRecherche] = useState('');
  const [categorieId, setCategorieId] = useState<string | undefined>();
  const [tagsActifs, setTagsActifs] = useState<string[]>([]);
  const [onglet, setOnglet] = useState<'attente' | 'toutes'>('attente');

  const recettes = useLiveQuery(async () => {
    const list = await db.recettes.filter(r => !r.archive && !r.deletedAt).toArray();
    return list.sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '', 'fr'));
  }, []);

  const categories = useLiveQuery(() => db.categoriesRecettes.orderBy('ordre').toArray(), []);
  const categoriesMap = new Map(categories?.map(c => [c.id, c]));

  const toggleTag = (tagId: string) => {
    setTagsActifs(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);
  };

  const filtered = (recettes ?? []).filter(r => {
    if (onglet === 'attente' && !r.aProgrammer) return false;
    if (categorieId && r.categorie !== categorieId) return false;
    if (tagsActifs.length > 0 && !tagsActifs.every(t => r.tags?.includes(t))) return false;
    if (recherche && !r.nom.toLowerCase().includes(recherche.toLowerCase())) return false;
    return true;
  });

  const handleSelect = useCallback(async (recetteId: string) => {
    try {
      await MenuService.addSlot({ menuId, recetteId });
      setAdded(prev => new Set(prev).add(recetteId));
    } catch { /* silencieux */ }
  }, [menuId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="rsel__overlay" onClick={onClose}>
      <div className="rsel__modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="rsel__header">
          <div className="rsel__header-top">
            <span className="rsel__title">Ajouter des recettes</span>
            <button className="rsel__close" onClick={onClose}>✕</button>
          </div>

          {/* Onglets */}
          <div className="rsel__tabs">
            <button
              className={`rsel__tab${onglet === 'attente' ? ' rsel__tab--active' : ''}`}
              onClick={() => setOnglet('attente')}
            >
              En attente
            </button>
            <button
              className={`rsel__tab${onglet === 'toutes' ? ' rsel__tab--active' : ''}`}
              onClick={() => setOnglet('toutes')}
            >
              Toutes
            </button>
          </div>

          {added.size > 0 && (
            <span className="rsel__count">{added.size} ajoutée{added.size > 1 ? 's' : ''}</span>
          )}

          <input
            className="rsel__search"
            placeholder="Rechercher une recette…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
          />

          {/* Chips catégories */}
          {categories && categories.length > 0 && (
            <div className="rsel__chips">
              <button
                className={`rsel__chip${!categorieId ? ' rsel__chip--active' : ''}`}
                onClick={() => setCategorieId(undefined)}
              >
                Toutes
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`rsel__chip${categorieId === cat.id ? ' rsel__chip--active' : ''}`}
                  onClick={() => setCategorieId(categorieId === cat.id ? undefined : cat.id)}
                >
                  {cat.nom}
                </button>
              ))}
            </div>
          )}

          {/* Chips tags */}
          <div className="rsel__chips">
            {TAGS_RECETTES.map(tag => (
              <button
                key={tag.id}
                className={`rsel__chip rsel__chip--tag${tagsActifs.includes(tag.id) ? ' rsel__chip--active' : ''}`}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grille */}
        <div className="rsel__scroll">
          {filtered.length === 0 ? (
            <p className="rsel__empty">
              {onglet === 'attente'
                ? 'Aucune recette en attente. Marque des recettes avec l\'icône archive depuis la bibliothèque.'
                : 'Aucune recette'}
            </p>
          ) : (
            <div className="rsel__grid">
              {filtered.map(r => (
                <RecetteThumb
                  key={r.id}
                  recette={r}
                  categorie={categoriesMap.get(r.categorie)}
                  added={added.has(r.id)}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="rsel__bottom">
          <button className="rsel__cta" onClick={onClose}>
            {added.size === 0 ? 'Fermer' : `Terminer · ${added.size} recette${added.size > 1 ? 's' : ''} ajoutée${added.size > 1 ? 's' : ''}`}
          </button>
        </div>

      </div>
    </div>
  );
}
