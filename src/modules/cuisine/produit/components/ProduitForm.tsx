import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../core/db/database';
import { newEntity, withUpdate, softDeleteFields } from '../../../../core/db/helpers';
import { normaliserNom } from '../../../../core/produits/ProduitService';
import { ConfirmModal } from '../../../../shared/components/ui/ConfirmModal';
import type { Produit } from '@shared/types/entities';
import './ProduitForm.css';

interface Props {
  produitId?: string;
  onSave: (id: string) => void;
  onCancel: () => void;
}

const UNITES = ['g', 'kg', 'ml', 'L', 'pièce(s)', 'tranche(s)', 'boîte(s)', 'sachet(s)', 'bouteille(s)', 'barquette'];

export function ProduitForm({ produitId, onSave, onCancel }: Props) {
  const [nom, setNom] = useState('');
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [unite, setUnite] = useState('');
  const [marque, setMarque] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categories = useLiveQuery(
    () => db.categoriesProduits.filter((c) => !c.deletedAt).sortBy('ordre'),
    [],
    []
  );

  const produitExistant = useLiveQuery<Produit | undefined>(
    () => (produitId ? db.produits.get(produitId) : undefined),
    [produitId]
  );

  useEffect(() => {
    if (produitExistant) {
      setNom(produitExistant.nom);
      setSelectedCatIds(produitExistant.categorieIds ?? (produitExistant.categorie ? [produitExistant.categorie] : []));
      setUnite(produitExistant.unite ?? '');
      setMarque(produitExistant.marque ?? '');
      setNotes(produitExistant.notes ?? '');
    }
  }, [produitExistant]);

  function toggleCategorie(id: string) {
    setSelectedCatIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (!nom.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const categoriePrimaire = selectedCatIds[0] ?? '';
      const commonFields = {
        nom: nom.trim(),
        nomNormalise: normaliserNom(nom.trim()),
        type: 'consommable' as const,
        categorie: categoriePrimaire,
        categorieIds: selectedCatIds,
        unite: unite || undefined,
        marque: marque.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (produitId && produitExistant) {
        await db.produits.update(produitId, withUpdate<Produit>(commonFields));
        onSave(produitId);
      } else {
        const produit = newEntity<Produit>({
          ...commonFields,
          frequenceAchat: 0,
          archive: false,
        });
        await db.produits.add(produit);
        onSave(produit.id);
      }
    } catch {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!produitId) return;
    await db.produits.update(produitId, softDeleteFields());
    onCancel();
  }

  return (
    <div className="produit-form">

      {/* Nom */}
      <div className="produit-form__field">
        <label className="produit-form__label">
          Nom <span className="produit-form__required">*</span>
        </label>
        <input
          className="produit-form__input"
          value={nom}
          onChange={(e) => { setNom(e.target.value); setError(''); }}
          placeholder="Ex. : Lait demi-écrémé, Farine T55…"
          autoFocus
        />
        {error && <p className="produit-form__error">{error}</p>}
      </div>

      {/* Catégories */}
      <div className="produit-form__field">
        <label className="produit-form__label">Catégorie</label>
        <div className="produit-form__cat-grid">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={['produit-form__cat-chip', selectedCatIds.includes(cat.id) ? 'produit-form__cat-chip--active' : ''].join(' ')}
              onClick={() => toggleCategorie(cat.id)}
            >
              
              {cat.nom}
            </button>
          ))}
        </div>
      </div>

      {/* Unité + Marque */}
      <div className="produit-form__row">
        <div className="produit-form__field">
          <label className="produit-form__label">Unité</label>
          <select
            className="produit-form__select"
            value={unite}
            onChange={(e) => setUnite(e.target.value)}
          >
            <option value="">Aucune</option>
            {UNITES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="produit-form__field">
          <label className="produit-form__label">Marque</label>
          <input
            className="produit-form__input"
            value={marque}
            onChange={(e) => setMarque(e.target.value)}
            placeholder="Facultatif"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="produit-form__field">
        <label className="produit-form__label">Notes</label>
        <textarea
          className="produit-form__textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Bio, origine, conseils…"
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="produit-form__actions">
        {produitId && (
          <button className="produit-form__btn-delete" onClick={() => setConfirmDelete(true)}>
            Supprimer
          </button>
        )}
        <button className="produit-form__btn-cancel" onClick={onCancel}>Annuler</button>
        <button
          className="produit-form__btn-save"
          onClick={handleSave}
          disabled={saving || !nom.trim()}
        >
          {saving ? '…' : produitId ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Supprimer ce produit ?"
        confirmLabel="Supprimer"
        danger
        onConfirm={() => { setConfirmDelete(false); doDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
