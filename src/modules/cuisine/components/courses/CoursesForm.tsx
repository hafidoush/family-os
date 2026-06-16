/**
 * FAMILY OS — CoursesForm
 * src/modules/cuisine/components/courses/CoursesForm.tsx
 *
 * Drawer d'ajout manuel — version 2 avec autocomplétion catalogue produits.
 * Rétrocompatible : si l'utilisateur ignore les suggestions, comportement inchangé.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../core/db/database';
import { Drawer } from '../../../../shared/components/ui/Drawer';
import { Button } from '../../../../shared/components/ui/Button';
import { Input } from '../../../../shared/components/ui/Input';
import { Select } from '../../../../shared/components/ui/Select';
import { CoursesService } from '../../services/CoursesService';
import { ProduitService } from '../../../../core/produits/ProduitService';
import type { Produit } from '@shared/types/entities';
import './CoursesForm.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const UNITES_COMMUNES = ['g', 'kg', 'ml', 'L', 'pièce(s)', 'tranche(s)', 'boîte(s)', 'sachet(s)', 'bouteille(s)'];

export function CoursesForm({ isOpen, onClose }: Props) {
  const [nom, setNom] = useState('');
  const [quantite, setQuantite] = useState('');
  const [unite, setUnite] = useState('');
  const [categorieProduitId, setCategorieProduitId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Autocomplétion
  const [suggestions, setSuggestions] = useState<Produit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [produitSelectionne, setProduitSelectionne] = useState<Produit | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const categories = useLiveQuery(
    () => db.categoriesProduits.filter(c => !c.deletedAt).sortBy('nom'),
    [],
    []
  );

  // Reset à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setNom('');
      setQuantite('');
      setUnite('');
      setCategorieProduitId('');
      setNotes('');
      setError('');
      setSuggestions([]);
      setShowSuggestions(false);
      setProduitSelectionne(null);
    }
  }, [isOpen]);

  // Recherche dans le catalogue avec debounce 200ms
  const handleNomChange = useCallback((value: string) => {
    setNom(value);
    setError('');
    setProduitSelectionne(null); // on désélectionne si l'utilisateur retape

    clearTimeout(searchTimeout.current);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      const results = await ProduitService.search(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 200);
  }, []);

  // Sélection d'une suggestion du catalogue
  const handleSelectSuggestion = (produit: Produit) => {
    setProduitSelectionne(produit);
    setNom(produit.nom);
    setUnite(produit.unite ?? '');
    // Pré-remplir la catégorie si on la trouve
    setCategorieProduitId(produit.categorie ?? '');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = async () => {
    if (!nom.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    setIsSaving(true);
    try {
      if (produitSelectionne) {
        // Chemin catalogue : passe par ProduitService (incrémente frequenceAchat)
        await ProduitService.addToCourses({
          produitId: produitSelectionne.id,
          quantite: quantite ? parseFloat(quantite) : undefined,
          unite: unite || produitSelectionne.unite,
        });
      } else {
        // Chemin saisie libre : comportement original inchangé
        await CoursesService.addItem({
          nom: nom.trim(),
          quantite: quantite ? parseFloat(quantite) : undefined,
          unite: unite || undefined,
          categorieProduitId: categorieProduitId || undefined,
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    } catch {
      setError('Erreur lors de l\'ajout');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !showSuggestions) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const categorieOptions = [
    { value: '', label: 'Sans catégorie' },
    ...(categories ?? []).map(c => ({ value: c.id, label: c.nom })),
  ];

  const uniteOptions = [
    { value: '', label: 'Unité…' },
    ...UNITES_COMMUNES.map(u => ({ value: u, label: u })),
  ];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Ajouter un article">
      <div className="courses-form">

        <div className="courses-form__field courses-form__field--autocomplete">
          <label className="courses-form__label" htmlFor="cf-nom">
            Article <span className="courses-form__required">*</span>
          </label>
          <div className="courses-form__autocomplete-wrapper">
            <Input
              id="cf-nom"
              value={nom}
              onChange={e => handleNomChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Ex. : Lait, Carottes, Farine..."
              autoFocus
              autoComplete="off"
            />
            {produitSelectionne && (
              <span className="courses-form__catalogue-badge" title="Produit du catalogue">
                📚
              </span>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="courses-form__suggestions">
                {suggestions.map(p => (
                  <li
                    key={p.id}
                    className="courses-form__suggestion-item"
                    onMouseDown={() => handleSelectSuggestion(p)}
                  >
                    <span className="courses-form__suggestion-nom">{p.nom}</span>
                    {p.unite && (
                      <span className="courses-form__suggestion-unite">{p.unite}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <p className="courses-form__error">{error}</p>}
        </div>

        <div className="courses-form__row">
          <div className="courses-form__field courses-form__field--sm">
            <label className="courses-form__label" htmlFor="cf-quantite">Quantité</label>
            <Input
              id="cf-quantite"
              type="number"
              min="0"
              step="0.1"
              value={quantite}
              onChange={e => setQuantite(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="courses-form__field courses-form__field--md">
            <label className="courses-form__label" htmlFor="cf-unite">Unité</label>
            <Select
              id="cf-unite"
              value={unite}
              onChange={e => setUnite(e.target.value)}
              options={uniteOptions}
            />
          </div>
        </div>

        {/* Catégorie et notes : masqués si produit du catalogue (déjà définis) */}
        {!produitSelectionne && (
          <>
            <div className="courses-form__field">
              <label className="courses-form__label" htmlFor="cf-categorie">Catégorie</label>
              <Select
                id="cf-categorie"
                value={categorieProduitId}
                onChange={e => setCategorieProduitId(e.target.value)}
                options={categorieOptions}
              />
            </div>

            <div className="courses-form__field">
              <label className="courses-form__label" htmlFor="cf-notes">Notes</label>
              <Input
                id="cf-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Bio, marque préférée..."
              />
            </div>
          </>
        )}

        <div className="courses-form__actions">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSaving || !nom.trim()}>
            {isSaving ? 'Ajout…' : 'Ajouter'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
