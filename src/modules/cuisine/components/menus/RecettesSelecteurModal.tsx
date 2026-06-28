import { useState, useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../core/db/database';
import { MenuService } from '../../services/MenuService';
import type { Recette, CategorieRecette } from '../../../../shared/types';
import './RecettesSelecteurModal.css';

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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <span className="rsel__thumb-nom">{recette.nom}</span>
    </button>
  );
}

interface Props {
  menuId: string;
  onClose: () => void;
}

export function RecettesSelecteurModal({ menuId, onClose }: Props) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [recherche, setRecherche] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const recettes = useLiveQuery(async () => {
    const list = await db.recettes.filter(r => !r.archive && !r.deletedAt).toArray();
    return list.sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '', 'fr'));
  }, []);

  const categories = useLiveQuery(() => db.categoriesRecettes.orderBy('ordre').toArray(), []);
  const categoriesMap = new Map(categories?.map(c => [c.id, c]));

  const filtered = recettes?.filter(r =>
    !recherche || r.nom.toLowerCase().includes(recherche.toLowerCase())
  ) ?? [];

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
    <div className="wm-modal-overlay" onClick={onClose}>
      <div className="wm-modal rsel__modal" onClick={e => e.stopPropagation()}>

        {/* Header fixe */}
        <div className="wm-modal__top rsel__top">
          <button className="wm-modal__close" onClick={onClose} aria-label="Fermer">✕</button>
          <div className="wm-modal__header">
            <span className="wm-modal__title">Ajouter des recettes</span>
            {added.size > 0 && (
              <span className="rsel__count">{added.size} ajoutée{added.size > 1 ? 's' : ''}</span>
            )}
          </div>
          <input
            className="rsel__search"
            placeholder="Rechercher…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
          />
        </div>

        {/* Grille scrollable */}
        <div className="wm-modal__scroll-wrap">
          <div className="wm-modal__scroll rsel__scroll" ref={scrollRef}>
            {filtered.length === 0 ? (
              <p className="wm-modal__empty">Aucune recette</p>
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
        </div>

        {/* CTA bas */}
        <div className="wm-modal__bottom">
          <button className="wm-modal__cta" style={{ background: '#7C3AED' }} onClick={onClose}>
            {added.size === 0 ? 'Fermer' : `Terminer (${added.size} recette${added.size > 1 ? 's' : ''})`}
          </button>
        </div>

      </div>
    </div>
  );
}
