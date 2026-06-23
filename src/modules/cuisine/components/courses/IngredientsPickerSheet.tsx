/**
 * FAMILY OS — IngredientsPickerSheet
 * Affiche les ingrédients d'un menu avec cases à cocher.
 * Pré-coche les ingrédients qui ne sont pas encore dans la liste de courses.
 * L'utilisateur décoche ce qu'il a déjà, puis valide pour ajouter le reste.
 */
import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import { newEntity } from '../../../../core/db/helpers'
import { IconClose } from '@shared/components/ui/Icon/Icon'
import type { CoursesItem } from '@shared/types'
import './IngredientsPickerSheet.css'

interface Ingredient {
  id: string         // RecetteIngredient.id
  produitId: string
  nom: string
  quantite: number
  unite?: string
  recetteNom: string
  dejaDansListe: boolean
}

interface Props {
  menuId: string
  onClose: () => void
}

export function IngredientsPickerSheet({ menuId, onClose }: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  // Items déjà dans la liste de courses
  const coursesItems = useLiveQuery(
    () => db.coursesItems.filter(i => !i.archive && !i.deletedAt).toArray(),
    []
  )

  useEffect(() => {
    if (coursesItems === undefined) return
    loadIngredients()
  }, [menuId, coursesItems])

  async function loadIngredients() {
    setLoading(true)
    try {
      // 1. Slots du menu
      const slots = await db.menuSlots
        .filter(s => s.menu === menuId && !s.deletedAt)
        .toArray()

      const recetteIds = [...new Set(slots.map(s => s.recette).filter((r): r is string => !!r))]
      if (recetteIds.length === 0) {
        setIngredients([])
        setLoading(false)
        return
      }

      // 2. Ingrédients de toutes les recettes
      const allIngredients = await Promise.all(
        recetteIds.map(rid => db.recettesIngredients.where('recette').equals(rid).toArray())
      ).then(lists => lists.flat())

      // 3. Produits + recettes
      const [produits, recettes] = await Promise.all([
        db.produits.toArray(),
        db.recettes.toArray(),
      ])
      const produitsMap = new Map(produits.map(p => [p.id, p]))
      const recettesMap = new Map(recettes.map(r => [r.id, r]))

      // 4. IDs déjà dans la liste de courses
      const dejaDansListe = new Set(
        (coursesItems ?? []).map(i => i.produit).filter(Boolean)
      )

      // 5. Dédupliquer par produit (agréger quantités)
      const parProduit = new Map<string, Ingredient>()
      for (const ing of allIngredients) {
        const produit = produitsMap.get(ing.produit)
        if (!produit) continue
        const recette = recettesMap.get(ing.recette)
        const existing = parProduit.get(ing.produit)
        if (existing) {
          // Agréger les quantités si même unité
          if (existing.unite === ing.unite) {
            parProduit.set(ing.produit, { ...existing, quantite: existing.quantite + ing.quantite })
          }
        } else {
          parProduit.set(ing.produit, {
            id: ing.id,
            produitId: ing.produit,
            nom: produit.nom,
            quantite: ing.quantite,
            unite: ing.unite,
            recetteNom: recette?.nom ?? '',
            dejaDansListe: dejaDansListe.has(ing.produit),
          })
        }
      }

      const liste = [...parProduit.values()].sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '', 'fr'))
      setIngredients(liste)

      // Pré-cocher uniquement ceux qui ne sont pas encore dans la liste
      const preselection = new Set(
        liste.filter(i => !i.dejaDansListe).map(i => i.produitId)
      )
      setSelection(preselection)
    } finally {
      setLoading(false)
    }
  }

  function toggleItem(produitId: string) {
    setSelection(prev => {
      const next = new Set(prev)
      if (next.has(produitId)) next.delete(produitId)
      else next.add(produitId)
      return next
    })
  }

  function toggleTout() {
    if (selection.size === ingredients.filter(i => !i.dejaDansListe).length) {
      setSelection(new Set())
    } else {
      setSelection(new Set(ingredients.filter(i => !i.dejaDansListe).map(i => i.produitId)))
    }
  }

  async function handleAjouter() {
    if (selection.size === 0) { onClose(); return }
    setSaving(true)
    try {
      const aAjouter = ingredients.filter(i => selection.has(i.produitId))
      await Promise.all(aAjouter.map(ing =>
        db.coursesItems.add(newEntity<CoursesItem>({
          produit: ing.produitId,
          nom: ing.nom,
          quantite: ing.quantite,
          unite: ing.unite,
          coche: false,
          source: 'menu',
          menuId,
          dateAjout: new Date(),
        }))
      ))
      setFeedback(`${aAjouter.length} article${aAjouter.length > 1 ? 's' : ''} ajouté${aAjouter.length > 1 ? 's' : ''} à la liste`)
      setTimeout(onClose, 1200)
    } finally {
      setSaving(false)
    }
  }

  const manquants = ingredients.filter(i => !i.dejaDansListe)
  const dejaPresents = ingredients.filter(i => i.dejaDansListe)

  return (
    <div className="ingr-sheet__overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ingr-sheet">
        {/* Header */}
        <div className="ingr-sheet__header">
          <h2 className="ingr-sheet__title">Ingrédients du menu</h2>
          <button className="ingr-sheet__close" onClick={onClose} aria-label="Fermer"><IconClose size={18} /></button>
        </div>

        {loading ? (
          <div className="ingr-sheet__loading">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="ingr-sheet__skel" style={{ width: `${50 + i * 10}%` }} />
            ))}
          </div>
        ) : ingredients.length === 0 ? (
          <div className="ingr-sheet__empty">
            <p>Aucune recette avec des ingrédients dans ce menu.</p>
            <p className="ingr-sheet__empty-hint">Ajoutez des recettes au menu pour voir leurs ingrédients.</p>
          </div>
        ) : (
          <>
            {/* Sous-titre et toggle tout */}
            {manquants.length > 0 && (
              <div className="ingr-sheet__toolbar">
                <span className="ingr-sheet__subtitle">
                  {selection.size} sur {manquants.length} sélectionné{selection.size > 1 ? 's' : ''}
                </span>
                <button className="ingr-sheet__toggle-all" onClick={toggleTout}>
                  {selection.size === manquants.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>
            )}

            <div className="ingr-sheet__list">
              {/* Manquants */}
              {manquants.length > 0 && (
                <div className="ingr-sheet__group">
                  <div className="ingr-sheet__group-label">À acheter</div>
                  {manquants.map(ing => (
                    <label key={ing.produitId} className="ingr-sheet__item">
                      <input
                        type="checkbox"
                        className="ingr-sheet__checkbox"
                        checked={selection.has(ing.produitId)}
                        onChange={() => toggleItem(ing.produitId)}
                      />
                      <div className="ingr-sheet__item-info">
                        <span className="ingr-sheet__item-nom">{ing.nom}</span>
                        {(ing.quantite > 0 || ing.unite) && (
                          <span className="ingr-sheet__item-qte">
                            {ing.quantite > 0 ? ing.quantite : ''}{ing.unite ? ` ${ing.unite}` : ''}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Déjà dans la liste */}
              {dejaPresents.length > 0 && (
                <div className="ingr-sheet__group ingr-sheet__group--present">
                  <div className="ingr-sheet__group-label ingr-sheet__group-label--present">
                    ✓ Déjà dans ta liste ({dejaPresents.length})
                  </div>
                  {dejaPresents.map(ing => (
                    <div key={ing.produitId} className="ingr-sheet__item ingr-sheet__item--present">
                      <span className="ingr-sheet__item-check">✓</span>
                      <div className="ingr-sheet__item-info">
                        <span className="ingr-sheet__item-nom">{ing.nom}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        {!loading && ingredients.length > 0 && (
          <div className="ingr-sheet__footer">
            {feedback ? (
              <div className="ingr-sheet__feedback">{feedback}</div>
            ) : (
              <>
                <button className="ingr-sheet__btn-cancel" onClick={onClose}>
                  Annuler
                </button>
                <button
                  className="ingr-sheet__btn-add"
                  onClick={handleAjouter}
                  disabled={saving || selection.size === 0}
                >
                  {saving
                    ? <span className="ingr-sheet__spinner" />
                    : `Ajouter ${selection.size > 0 ? selection.size : ''} article${selection.size > 1 ? 's' : ''}`
                  }
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
