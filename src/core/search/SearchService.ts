/**
 * FAMILY OS — SearchService
 * Moteur de recherche global basé sur Fuse.js (A-34, A-35).
 * Singleton — buildIndex() à appeler au démarrage après db.open().
 */
import Fuse from 'fuse.js'
import type { db as DbType } from '../db/database'
import type { Tache, Evenement, Produit, Recette, Note } from '@shared/types'

export type SearchableType =
  | 'tache'
  | 'evenement'
  | 'produit'
  | 'recette'
  | 'note'
  | 'membre'
  | 'activite'
  | 'souvenir'
  | 'projetMaison'

export interface SearchResult {
  id: string
  type: SearchableType
  titre: string
  score: number
}

interface IndexedItem {
  id: string
  type: SearchableType
  titre: string
  description?: string
}

const FUSE_OPTIONS: ConstructorParameters<typeof Fuse<IndexedItem>>[1] = {
  keys: [
    { name: 'titre', weight: 0.7 },
    { name: 'description', weight: 0.3 },
  ],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 2,
}

let fuse: Fuse<IndexedItem> | null = null
let items: IndexedItem[] = []

function rebuildFuse(): void {
  fuse = new Fuse(items, FUSE_OPTIONS)
}

export const searchService = {
  /**
   * Construit l'index complet depuis la base IndexedDB.
   * À appeler au démarrage de l'application (après db.open()).
   * Correction M-05 : champ `archive` (camelCase, pas `archivee`)
   */
  async buildIndex(db: typeof DbType): Promise<void> {
    const [taches, evenements, produits, recettes, notes] = await Promise.all([
      db.taches.filter((t: Tache) => !t.archive).toArray(),
      db.evenements.filter((e: Evenement) => !e.archive).toArray(),
      db.produits.filter((p: Produit) => !p.archive).toArray(),
      db.recettes.filter((r: Recette) => !r.archive).toArray(),
      db.notes.filter((n: Note) => !n.archive).toArray(),
    ])

    items = [
      ...taches.map((t: Tache) => ({
        id: t.id,
        type: 'tache' as const,
        titre: t.titre,
        description: t.description,
      })),
      ...evenements.map((e: Evenement) => ({
        id: e.id,
        type: 'evenement' as const,
        titre: e.titre,
      })),
      ...produits.map((p: Produit) => ({
        id: p.id,
        type: 'produit' as const,
        titre: p.nom,
        description: p.notes,
      })),
      ...recettes.map((r: Recette) => ({
        id: r.id,
        type: 'recette' as const,
        titre: r.nom,
      })),
      ...notes.map((n: Note) => ({
        id: n.id,
        type: 'note' as const,
        titre: n.titre ?? '',
        description: n.contenu,
      })),
    ]

    rebuildFuse()
  },

  /**
   * Recherche dans l'index. Retourne les résultats triés par score (meilleur en premier).
   */
  query(q: string): SearchResult[] {
    if (!fuse || !q.trim()) return []
    return fuse
      .search(q)
      .map((r) => ({ ...r.item, score: r.score ?? 1 }))
      .sort((a, b) => a.score - b.score)
  },

  /**
   * Mise à jour incrémentale d'une entité dans l'index (A-34).
   */
  reindexEntity(
    entity: {
      id: string
      titre?: string
      nom?: string
      contenu?: string
      description?: string
    },
    type: SearchableType
  ): void {
    items = items.filter((i) => i.id !== entity.id)
    items.push({
      id: entity.id,
      type,
      titre: entity.titre ?? entity.nom ?? '',
      description: entity.description ?? entity.contenu,
    })
    rebuildFuse()
  },

  /**
   * Supprime une entité de l'index (A-35).
   */
  removeFromIndex(id: string): void {
    items = items.filter((i) => i.id !== id)
    rebuildFuse()
  },
}
