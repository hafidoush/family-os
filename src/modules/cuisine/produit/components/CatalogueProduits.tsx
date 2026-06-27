import { useState } from 'react';
import { useProduits } from '../hooks/useProduits';
import { ProduitForm } from './ProduitForm';
import { AjoutCoursesSheet } from './AjoutCoursesSheet';
import type { Produit } from '@shared/types/entities';
import type { CategorieProduit } from '@shared/types/modules';
import { IconCart } from '@shared/components/ui/Icon/Icon';
import './CatalogueProduits.css';

type View =
  | { type: 'catalogue' }
  | { type: 'form'; produitId?: string };

export function CatalogueProduits() {
  const [view, setView] = useState<View>({ type: 'catalogue' });
  const [activeCatId, setActiveCatId] = useState<string | undefined>(undefined);
  const [ajoutTarget, setAjoutTarget] = useState<Produit | null>(null);
  const [ajoutConfirm, setAjoutConfirm] = useState(false);

  const { produits, categories, isLoading } = useProduits(activeCatId);

  if (view.type === 'form') {
    return (
      <div className="catalogue-produits__form-wrapper">
        <div className="catalogue-produits__back-bar">
          <button
            className="catalogue-produits__back"
            onClick={() => setView({ type: 'catalogue' })}
          >
            ← Catalogue
          </button>
        </div>
        <ProduitForm
          produitId={view.produitId}
          onSave={() => setView({ type: 'catalogue' })}
          onCancel={() => setView({ type: 'catalogue' })}
        />
      </div>
    );
  }

  return (
    <div className="catalogue-produits">
      {/* Filtres catégories */}
      <div className="catalogue-produits__cats">
        <button
          className={['catalogue-cat-chip', !activeCatId ? 'catalogue-cat-chip--active' : ''].join(' ')}
          onClick={() => setActiveCatId(undefined)}
        >
          Tous
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={['catalogue-cat-chip', activeCatId === cat.id ? 'catalogue-cat-chip--active' : ''].join(' ')}
            onClick={() => setActiveCatId(activeCatId === cat.id ? undefined : cat.id)}
          >
            
            {cat.nom}
          </button>
        ))}
      </div>

      {/* Compteur */}
      {!isLoading && (
        <p className="catalogue-produits__count">
          {produits.length} produit{produits.length !== 1 ? 's' : ''}
          {activeCatId ? ` · ${categories.find((c) => c.id === activeCatId)?.nom ?? ''}` : ''}
        </p>
      )}

      {/* Squelettes */}
      {isLoading && (
        <div className="catalogue-produits__list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="catalogue-produits__skeleton" />
          ))}
        </div>
      )}

      {/* Liste vide */}
      {!isLoading && produits.length === 0 && (
        <div className="catalogue-produits__empty">
          <span className="catalogue-produits__empty-icon">🧺</span>
          <p className="catalogue-produits__empty-text">
            {activeCatId ? 'Aucun produit dans cette catégorie' : 'Catalogue vide'}
          </p>
          <button
            className="catalogue-produits__empty-btn"
            onClick={() => setView({ type: 'form' })}
          >
            Ajouter un produit
          </button>
        </div>
      )}

      {/* Items */}
      {!isLoading && produits.length > 0 && (
        <div className="catalogue-produits__list">
          {produits.map((produit) => (
            <ProduitRow
              key={produit.id}
              produit={produit}
              categories={categories}
              onEdit={() => setView({ type: 'form', produitId: produit.id })}
              onAjoutCourses={() => setAjoutTarget(produit)}
            />
          ))}
        </div>
      )}

      {/* FAB ajout */}
      <button
        className="catalogue-produits__fab"
        onClick={() => setView({ type: 'form' })}
        aria-label="Nouveau produit"
      >
        +
      </button>

      {/* Bottom sheet ajout aux courses */}
      {ajoutTarget && (
        <AjoutCoursesSheet
          produit={ajoutTarget}
          onClose={() => setAjoutTarget(null)}
          onAdded={() => {
            setAjoutTarget(null);
            setAjoutConfirm(true);
            setTimeout(() => setAjoutConfirm(false), 2000);
          }}
        />
      )}

      {/* Toast confirmation */}
      {ajoutConfirm && (
        <div className="catalogue-produits__toast">
          ✓ Ajouté aux courses
        </div>
      )}
    </div>
  );
}

// ── Ligne produit ─────────────────────────────────────────────────────────────

interface ProduitRowProps {
  produit: Produit;
  categories: CategorieProduit[];
  onEdit: () => void;
  onAjoutCourses: () => void;
}

function ProduitRow({ produit, categories, onEdit, onAjoutCourses }: ProduitRowProps) {
  const catNoms = (produit.categorieIds ?? (produit.categorie ? [produit.categorie] : []))
    .map((id) => categories.find((c) => c.id === id)?.nom)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="catalogue-produit-row">
      <button className="catalogue-produit-row__body" onClick={onAjoutCourses}>
        <div className="catalogue-produit-row__info">
          <p className="catalogue-produit-row__nom">{produit.nom}</p>
          <p className="catalogue-produit-row__meta">
            {[catNoms, produit.marque, produit.unite].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="catalogue-produit-row__add" aria-label="Ajouter aux courses">
          <IconCart size={18} />
        </span>
      </button>
      <button className="catalogue-produit-row__edit" onClick={onEdit} aria-label="Modifier">
        ›
      </button>
    </div>
  );
}
