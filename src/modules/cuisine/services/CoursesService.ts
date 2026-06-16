import { db } from '../../../core/db/database';
import { newEntity, withUpdate, softDeleteFields } from '../../../core/db/helpers';
import { emit } from '../../../core/automation/engine';
import type { CoursesItem } from '../../../shared/types';

// ─── Types locaux ────────────────────────────────────────────────────────────

export interface CreateCoursesItemInput {
  produitId?: string;     // FK optionnel — si item du catalogue
  nom?: string;           // libellé libre (si pas de produit)
  quantite?: number;
  unite?: string;
  categorieProduitId?: string;
  notes?: string;
  menuId?: string;
  recetteId?: string;
}

export interface UpdateCoursesItemInput {
  nom?: string;
  quantite?: number;
  unite?: string;
  categorieProduitId?: string;
  notes?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const CoursesService = {

  /** Ajoute un item manuel à la liste de courses (déduplique sur produitId ou nom) */
  async addItem(input: CreateCoursesItemInput): Promise<string> {
    // Déduplication : si un item actif avec le même produit ou nom existe déjà, on le retourne
    const existants = await db.coursesItems.filter(i => !i.archive && !i.deletedAt).toArray();
    if (input.produitId) {
      const doublon = existants.find(i => i.produit === input.produitId);
      if (doublon) return doublon.id;
    } else if (input.nom) {
      const nomNorm = input.nom.toLowerCase().trim();
      const doublon = existants.find(i => i.nom?.toLowerCase().trim() === nomNorm);
      if (doublon) return doublon.id;
    }

    const item = newEntity<CoursesItem>({
      produit: input.produitId ?? '',
      nom: input.nom,
      quantite: input.quantite,
      unite: input.unite,
      categorieProduitId: input.categorieProduitId,
      notes: input.notes,
      menuId: input.menuId,
      recetteId: input.recetteId,
      coche: false,
      source: 'manuel',
      dateAjout: new Date(),
    });
    await db.coursesItems.add(item);
    emit('courses_item.added_manual', { coursesItem: item, nom: input.nom ?? input.produitId ?? '' });
    return item.id;
  },

  /** Coche ou décoche un item */
  async toggleCoche(id: string): Promise<void> {
    const item = await db.coursesItems.get(id);
    if (!item) return;
    const coche = !item.coche;
    await db.coursesItems.update(id, withUpdate<CoursesItem>({ coche }));
    if (coche) {
      emit('courses_item.checked', { coursesItem: { ...item, coche } });
    }
  },

  /** Met à jour les infos d'un item */
  async updateItem(id: string, input: UpdateCoursesItemInput): Promise<void> {
    await db.coursesItems.update(id, withUpdate<CoursesItem>(input));
  },

  /** Soft-delete un item */
  async deleteItem(id: string): Promise<void> {
    await db.coursesItems.update(id, softDeleteFields());
  },

  /** Archive tous les items cochés */
  async archiverCoches(): Promise<number> {
    const coches = await db.coursesItems
      .filter(i => i.coche === true && !i.archive && !i.deletedAt)
      .toArray();
    for (const item of coches) {
      await db.coursesItems.update(item.id, withUpdate<CoursesItem>({ archive: true }));
    }
    return coches.length;
  },

  /** Vide toute la liste */
  async viderListe(): Promise<void> {
    const actifs = await db.coursesItems
      .filter(i => !i.archive && !i.deletedAt)
      .toArray();
    for (const item of actifs) {
      await db.coursesItems.update(item.id, softDeleteFields());
    }
  },

  /**
   * Génère les courses depuis un menu validé.
   */
  async genererDepuisMenu(menuId: string): Promise<number> {
    const menu = await db.menus.get(menuId);
    if (!menu) throw new Error(`Menu ${menuId} introuvable`);

    const slots = await db.menuSlots
      .filter(s => s.menu === menuId && !s.deletedAt)
      .toArray();

    const recetteIds = [...new Set(
      slots.map(s => s.recette).filter((r): r is string => !!r)
    )];

    const ingredients = await Promise.all(
      recetteIds.map(rid => db.recettesIngredients.where('recette').equals(rid).toArray())
    ).then(lists => lists.flat());

    const existants = await db.coursesItems
      .filter(i => !i.archive && !i.deletedAt)
      .toArray();
    const existantsProduitIds = new Set(existants.map(i => i.produit).filter(Boolean));
    const existantsNoms = new Set(
      existants.map(i => i.nom?.toLowerCase().trim()).filter(Boolean)
    );

    let ajoutes = 0;
    for (const ing of ingredients) {
      if (existantsProduitIds.has(ing.produit)) continue;
      const item = newEntity<CoursesItem>({
        produit: ing.produit,
        quantite: ing.quantite,
        unite: ing.unite,
        coche: false,
        source: 'menu',
        menuId,
        recetteId: ing.recette,
        dateAjout: new Date(),
      });
      await db.coursesItems.add(item);
      existantsProduitIds.add(ing.produit);
      ajoutes++;
    }

    emit('menu.validated', { menu });
    return ajoutes;
  },

  /** Restaure les items archivés */
  async desarchiverTout(): Promise<void> {
    const archives = await db.coursesItems
      .filter(i => i.archive === true && !i.deletedAt)
      .toArray();
    for (const item of archives) {
      await db.coursesItems.update(item.id, withUpdate<CoursesItem>({ archive: false, coche: false }));
    }
  },
};
