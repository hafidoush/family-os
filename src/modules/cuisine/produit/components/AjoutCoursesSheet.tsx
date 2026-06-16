import { useState } from 'react';
import { ProduitService } from '../../../../core/produits/ProduitService';
import type { Produit } from '@shared/types/entities';
import { IconCart } from '@shared/components/ui/Icon/Icon';
import './AjoutCoursesSheet.css';

interface Props {
  produit: Produit;
  onClose: () => void;
  onAdded: () => void;
}

const UNITES = ['g', 'kg', 'ml', 'L', 'pièce(s)', 'tranche(s)', 'boîte(s)', 'sachet(s)', 'bouteille(s)', 'barquette'];

export function AjoutCoursesSheet({ produit, onClose, onAdded }: Props) {
  const [quantite, setQuantite] = useState('');
  const [unite, setUnite] = useState(produit.unite ?? '');
  const [adding, setAdding] = useState(false);

  async function handleAjouter() {
    setAdding(true);
    try {
      await ProduitService.addToCourses({
        produitId: produit.id,
        quantite: quantite ? parseFloat(quantite) : undefined,
        unite: unite || produit.unite,
      });
      onAdded();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="ajout-courses-overlay" onClick={onClose}>
      <div className="ajout-courses-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ajout-courses-sheet__handle" />

        <div className="ajout-courses-sheet__header">
          <p className="ajout-courses-sheet__nom">{produit.nom}</p>
          {produit.marque && (
            <p className="ajout-courses-sheet__marque">{produit.marque}</p>
          )}
        </div>

        <div className="ajout-courses-sheet__fields">
          <div className="ajout-courses-sheet__field">
            <label className="ajout-courses-sheet__label">Quantité</label>
            <input
              className="ajout-courses-sheet__input"
              type="number"
              min="0"
              step="0.1"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              placeholder="Ex. : 2"
              autoFocus
            />
          </div>
          <div className="ajout-courses-sheet__field">
            <label className="ajout-courses-sheet__label">Unité</label>
            <select
              className="ajout-courses-sheet__select"
              value={unite}
              onChange={(e) => setUnite(e.target.value)}
            >
              <option value="">Aucune</option>
              {UNITES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="ajout-courses-sheet__actions">
          <button className="ajout-courses-sheet__btn-cancel" onClick={onClose}>
            Annuler
          </button>
          <button
            className="ajout-courses-sheet__btn-add"
            onClick={handleAjouter}
            disabled={adding}
          >
            {adding ? '…' : <><IconCart size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Ajouter aux courses</>}
          </button>
        </div>
      </div>
    </div>
  );
}
