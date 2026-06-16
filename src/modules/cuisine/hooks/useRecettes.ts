import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import type { Recette, CategorieRecette } from '../../../shared/types'

export interface RecettesFilters {
  categorieId?: string
  favoriSeulement?: boolean
  kidsFavoriteSeulement?: boolean
  recherche?: string
}

export function useRecettes(filters: RecettesFilters = {}) {
  return useLiveQuery(async () => {
    let recettes = await db.recettes
      .filter((r) => !r.archive && !r.deletedAt)
      .toArray()

    if (filters.categorieId) {
      recettes = recettes.filter((r) => r.categorie === filters.categorieId)
    }
    if (filters.favoriSeulement) {
      recettes = recettes.filter((r) => r.favori)
    }
    if (filters.kidsFavoriteSeulement) {
      recettes = recettes.filter((r) => r.kidsFavorite)
    }
    if (filters.recherche) {
      const q = filters.recherche.toLowerCase()
      recettes = recettes.filter((r) => r.nom.toLowerCase().includes(q))
    }

    recettes.sort((a, b) => {
      if (a.favori && !b.favori) return -1
      if (!a.favori && b.favori) return 1
      return a.nom.localeCompare(b.nom, 'fr')
    })

    return recettes
  }, [filters.categorieId, filters.favoriSeulement, filters.kidsFavoriteSeulement, filters.recherche])
}

export function useRecette(id: string | null) {
  return useLiveQuery(
    async () => {
      if (!id) return null
      return db.recettes.get(id) ?? null
    },
    [id]
  )
}

export function useRecetteIngredients(recetteId: string | null) {
  return useLiveQuery(
    async () => {
      if (!recetteId) return []
      return db.recettesIngredients
        .where('recette')
        .equals(recetteId)
        .filter((i) => !i.deletedAt)
        .toArray()
    },
    [recetteId]
  )
}

export function useCategoriesRecettes() {
  return useLiveQuery(
    () => db.categoriesRecettes.orderBy('ordre').toArray()
  )
}