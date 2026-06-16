/**
 * FAMILY OS — RepasJour
 * F7 : Gestion repas mode libre — pas de menu figé, juste "qu'est-ce qu'on mange aujourd'hui ?"
 * L'utilisateur choisit librement depuis sa bibliothèque de recettes.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../../core/db/database'
import { newEntity } from '../../../../core/db/helpers'
import type { CoursesItem } from '../../../../shared/types'
import { IconClose, IconCart } from '@shared/components/ui/Icon/Icon'
import './RepasJour.css'

const REPAS = [
  { key: 'petit_dejeuner', label: 'Petit-déjeuner', emoji: '🌅' },
  { key: 'dejeuner',       label: 'Déjeuner',       emoji: '☀️' },
  { key: 'diner',          label: 'Dîner',           emoji: '🌙' },
] as const

type TypeRepas = typeof REPAS[number]['key']

interface SlotRepas {
  type: TypeRepas
  recetteId: string | null
  descriptionLibre: string | null
}

export function RepasJour() {
  const today = new Date().toISOString().split('T')[0]
  const [slots, setSlots] = useState<SlotRepas[]>([
    { type: 'petit_dejeuner', recetteId: null, descriptionLibre: null },
    { type: 'dejeuner',       recetteId: null, descriptionLibre: null },
    { type: 'diner',          recetteId: null, descriptionLibre: null },
  ])
  const [showPicker, setShowPicker] = useState<TypeRepas | null>(null)
  const [manquantsChecked, setManquantsChecked] = useState(false)

  const recettes = useLiveQuery(
    () => db.recettes.filter(r => !r.archive && !r.deletedAt).toArray()
      .then(list => list.sort((a, b) => a.nom.localeCompare(b.nom))),
    []
  )

  const choisirRecette = (type: TypeRepas, recetteId: string) => {
    setSlots(prev => prev.map(s => s.type === type ? { ...s, recetteId, descriptionLibre: null } : s))
    setShowPicker(null)
    setManquantsChecked(false)
  }

  const saisirLibre = (type: TypeRepas, texte: string) => {
    setSlots(prev => prev.map(s => s.type === type ? { ...s, recetteId: null, descriptionLibre: texte || null } : s))
  }

  const effacerSlot = (type: TypeRepas) => {
    setSlots(prev => prev.map(s => s.type === type ? { ...s, recetteId: null, descriptionLibre: null } : s))
    setManquantsChecked(false)
  }

  // Ajouter les ingrédients manquants aux courses
  const ajouterIngredients = async () => {
    const recetteIds = slots.map(s => s.recetteId).filter(Boolean) as string[]
    if (recetteIds.length === 0) return

    const deviceId = localStorage.getItem('family-os-device-id') ?? 'device-unknown'
    let ajoutees = 0

    for (const recetteId of recetteIds) {
      const ingredients = await db.recettesIngredients.where('recette').equals(recetteId).toArray()
      for (const ing of ingredients) {
        // Vérifier si déjà dans les courses
        const existant = await db.coursesItems
          .filter(c => !c.archive && !c.deletedAt && !c.coche && c.produit === ing.produit)
          .first()
        if (!existant) {
          await db.coursesItems.add(newEntity<CoursesItem>({
            produit: ing.produit,
            quantite: ing.quantite,
            unite: ing.unite,
            coche: false,
            source: 'recette',
            recetteId,
            dateAjout: new Date(),
            deviceId,
          } as Omit<CoursesItem, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>))
          ajoutees++
        }
      }
    }
    setManquantsChecked(true)
    if (ajoutees > 0) {
      alert(`${ajoutees} ingrédient${ajoutees > 1 ? 's' : ''} ajouté${ajoutees > 1 ? 's' : ''} aux courses`)
    } else {
      alert('Tous les ingrédients sont déjà dans ta liste de courses')
    }
  }

  const slotsAvecRecette = slots.filter(s => s.recetteId).length

  return (
    <div className="repas-jour">
      <div className="repas-jour__header">
        <h2 className="repas-jour__title">Repas du jour</h2>
        <span className="repas-jour__date">
          {new Date(today + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      <div className="repas-slots">
        {slots.map(slot => {
          const repasInfo = REPAS.find(r => r.key === slot.type)!
          const recette = slot.recetteId ? (recettes ?? []).find(r => r.id === slot.recetteId) : null

          return (
            <div key={slot.type} className="repas-slot">
              <div className="repas-slot__label">
                <span className="repas-slot__emoji">{repasInfo.emoji}</span>
                <span className="repas-slot__nom">{repasInfo.label}</span>
              </div>

              {recette ? (
                <div className="repas-slot__recette">
                  <span className="repas-slot__recette-nom">{recette.nom}</span>
                  {recette.tempsPreparation && (
                    <span className="repas-slot__temps">⏱ {recette.tempsPreparation}min</span>
                  )}
                  <button className="repas-slot__clear" onClick={() => effacerSlot(slot.type)}><IconClose size={14} /></button>
                </div>
              ) : slot.descriptionLibre ? (
                <div className="repas-slot__recette">
                  <span className="repas-slot__recette-nom">{slot.descriptionLibre}</span>
                  <button className="repas-slot__clear" onClick={() => effacerSlot(slot.type)}><IconClose size={14} /></button>
                </div>
              ) : (
                <div className="repas-slot__vide">
                  <button
                    className="repas-slot__pick"
                    onClick={() => setShowPicker(showPicker === slot.type ? null : slot.type)}
                  >
                    Choisir une recette
                  </button>
                  <input
                    className="repas-slot__libre"
                    placeholder="ou saisir librement…"
                    onBlur={e => { if (e.target.value) saisirLibre(slot.type, e.target.value) }}
                  />
                </div>
              )}

              {showPicker === slot.type && (
                <div className="repas-picker">
                  <div className="repas-picker__list">
                    {(recettes ?? []).map(r => (
                      <button
                        key={r.id}
                        className="repas-picker__item"
                        onClick={() => choisirRecette(slot.type, r.id)}
                      >
                        {r.nom}
                        {r.tempsPreparation && (
                          <span className="repas-picker__temps">⏱ {r.tempsPreparation}min</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {slotsAvecRecette > 0 && !manquantsChecked && (
        <button className="repas-cours-btn" onClick={ajouterIngredients}>
          <IconCart size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Vérifier les ingrédients manquants
        </button>
      )}

      {manquantsChecked && (
        <p className="repas-ok">✓ Courses vérifiées</p>
      )}
    </div>
  )
}
