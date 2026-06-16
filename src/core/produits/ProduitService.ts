/**
 * FAMILY OS — ProduitService
 * src/core/produits/ProduitService.ts
 *
 * Socle minimal : search, getByCategorie, add, addToCourses.
 * Aucune UI ici — ce service est consommé par CoursesForm (autocomplétion)
 * et pourra l'être par RecetteForm (Phase Cuisine v2) et le futur module Stock.
 */

import { db } from '../db/database';
import { newEntity, withUpdate } from '../db/helpers';
import type { Produit } from '@shared/types/entities';
import type { CoursesItem } from '@shared/types/modules';

// ─── Normalisation ─────────────────────────────────────────────────────────────

/**
 * Normalise un nom pour la recherche floue :
 * "Lait demi-écrémé" → "lait demi ecreme"
 */
export function normaliserNom(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/[-–—]/g, ' ')           // tirets → espaces
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProduitInput {
  nom: string;
  categorieId: string;
  unite?: string;
  marque?: string;
  type?: 'consommable' | 'achat_ponctuel';
}

export interface AddToCoursesInput {
  produitId: string;
  quantite?: number;
  unite?: string; // override l'unité par défaut du produit
}

// ─── ProduitService ────────────────────────────────────────────────────────────

export const ProduitService = {

  /**
   * Recherche dans le catalogue par nom normalisé.
   * Utilisé pour l'autocomplétion dans CoursesForm et RecetteForm.
   * Retourne max 8 résultats triés par frequenceAchat desc.
   */
  async search(query: string): Promise<Produit[]> {
    if (!query.trim()) return [];
    const q = normaliserNom(query);
    const all = await db.produits
      .filter(p => !p.archive && !p.deletedAt && (p.nomNormalise?.includes(q) ?? false))
      .toArray();
    return all
      .sort((a, b) => (b.frequenceAchat ?? 0) - (a.frequenceAchat ?? 0))
      .slice(0, 8);
  },

  /**
   * Retourne tous les produits d'une catégorie, triés par frequenceAchat puis nom.
   */
  async getByCategorie(categorieId: string): Promise<Produit[]> {
    const all = await db.produits
      .where('categorie')
      .equals(categorieId)
      .filter(p => !p.archive && !p.deletedAt)
      .toArray();
    return all.sort((a, b) => {
      const freq = (b.frequenceAchat ?? 0) - (a.frequenceAchat ?? 0);
      if (freq !== 0) return freq;
      return a.nom.localeCompare(b.nom, 'fr');
    });
  },

  /**
   * Ajoute un produit au catalogue.
   * nomNormalise est calculé automatiquement — ne jamais le passer en entrée.
   */
  async add(input: ProduitInput): Promise<string> {
    const produit = newEntity<Produit>({
      nom: input.nom.trim(),
      nomNormalise: normaliserNom(input.nom),
      type: input.type ?? 'consommable',
      categorie: input.categorieId,
      unite: input.unite,
      marque: input.marque,
      frequenceAchat: 0,
      archive: false,
    });
    await db.produits.add(produit);
    return produit.id;
  },

  /**
   * Ajoute un produit du catalogue directement en liste de courses.
   * Incrémente frequenceAchat pour améliorer le tri au fil du temps.
   * Vérifie le dédoublonnage (même produitId déjà actif = pas de doublon).
   */
  async addToCourses(input: AddToCoursesInput): Promise<void> {
    const produit = await db.produits.get(input.produitId);
    if (!produit) throw new Error(`Produit introuvable : ${input.produitId}`);

    // Dédoublonnage : si le produit est déjà dans la liste active, on ne réajoute pas
    const existant = await db.coursesItems
      .filter(
        item =>
          !item.archive &&
          !item.deletedAt &&
          item.produit === input.produitId
      )
      .first();

    if (!existant) {
      const item = newEntity<CoursesItem>({
        produit: input.produitId,
        quantite: input.quantite,
        unite: input.unite ?? produit.unite,
        coche: false,
        source: 'manuel',
        dateAjout: new Date(),
      });
      await db.coursesItems.add(item);
    }

    // Incrémenter frequenceAchat dans tous les cas (même si déjà en liste)
    await db.produits.update(
      input.produitId,
      withUpdate<Produit>({ frequenceAchat: (produit.frequenceAchat ?? 0) + 1 })
    );
  },

} as const;
