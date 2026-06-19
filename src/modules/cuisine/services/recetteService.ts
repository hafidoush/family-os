import { db } from '../../../core/db/database'
import { newEntity, withUpdate, softDeleteFields } from '../../../core/db/helpers'
import type { Recette, RecetteIngredient } from '../../../shared/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecetteFormData {
  nom: string
  categorie: string
  difficulte?: Recette['difficulte']
  tempsPreparation?: number
  tempsCuisson?: number
  portions?: number
  etapes: string[]
  tags?: string[]
  notes?: string
  image?: Blob       // legacy — ne plus utiliser
  imageData?: string // base64 data URL — fiable iOS
  typePreparation?: Recette['typePreparation']
  modeConservation?: string
  dureeConservation?: number
  congelable?: boolean
  kidsFavorite?: boolean
}

// ─── Utilitaire image ─────────────────────────────────────────────────────────

export async function compressImageToBase64(file: File, maxPx = 900, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const tempUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(tempUrl)
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas not supported')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = tempUrl
  })
}

export interface IngredientFormData {
  produit: string       // Produit.id
  quantite: number
  unite?: string
  optionnel: boolean
}

// ─── Recette CRUD ─────────────────────────────────────────────────────────────

export async function createRecette(
  data: RecetteFormData,
  ingredients: IngredientFormData[]
): Promise<string> {
  const recette = newEntity<Recette>({
    ...data,
    favori: false,
    archive: false,
  })

  await db.recettes.add(recette)

  // Ingrédients — add() individuel pour déclencher les hooks de sync (bulkAdd les bypasse)
  for (const ing of ingredients) {
    await db.recettesIngredients.add(
      newEntity<RecetteIngredient>({
        recette: recette.id,
        produit: ing.produit,
        quantite: ing.quantite,
        unite: ing.unite,
        optionnel: ing.optionnel,
      })
    )
  }

  return recette.id
}

export async function updateRecette(
  id: string,
  data: Partial<RecetteFormData>,
  ingredients?: IngredientFormData[]
): Promise<void> {
  await db.recettes.update(id, withUpdate(data))

  if (ingredients !== undefined) {
    // Remplacement complet des ingrédients : soft-delete puis ré-insertion
    const existants = await db.recettesIngredients.where('recette').equals(id).toArray()
    const now = new Date()
    await Promise.all(
      existants.map((e) =>
        db.recettesIngredients.update(e.id, {
          archive: true,
          deletedAt: now,
          updatedAt: now,
        })
      )
    )

    // add() individuel pour déclencher les hooks de sync (bulkAdd les bypasse)
    for (const ing of ingredients) {
      await db.recettesIngredients.add(
        newEntity<RecetteIngredient>({
          recette: id,
          produit: ing.produit,
          quantite: ing.quantite,
          unite: ing.unite,
          optionnel: ing.optionnel,
        })
      )
    }
  }
}

export async function toggleFavori(id: string, favori: boolean): Promise<void> {
  await db.recettes.update(id, withUpdate({ favori }))
}

export async function toggleKidsFavorite(id: string, kidsFavorite: boolean): Promise<void> {
  await db.recettes.update(id, withUpdate({ kidsFavorite }))
}

export async function deleteRecette(id: string): Promise<void> {
  await db.recettes.update(id, softDeleteFields())
}