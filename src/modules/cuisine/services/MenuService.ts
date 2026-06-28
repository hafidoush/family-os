/**
 * FAMILY OS — MenuService
 * CRUD pour les menus de semaine et leurs slots.
 * Toutes les écritures passent par ce service (D-07).
 */

import { v4 as uuid } from 'uuid';
import { db } from '@core/db/database';
import { newEntity } from '@core/db/helpers';
import { emit } from '@core/automation/engine';
import { toISODate } from '@shared/utils/formatDate';
import type { Menu, MenuSlot, JourMenu, RepasMenu } from '@shared/types';

// ─── Helpers internes ─────────────────────────────────────────────────────────

/** Calcule le lundi de la semaine contenant `date` */
function getLundi(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Calcule le dimanche de la semaine contenant `date` */
function getDimanche(date: Date): Date {
  const lundi = getLundi(date);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  return dimanche;
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0];
}


// ─── Types publics ────────────────────────────────────────────────────────────

export interface CreateMenuInput {
  /** Date de référence — le service calcule lundi/dimanche automatiquement */
  dateReference?: Date;
  /** Nom libre du menu — si absent, généré automatiquement */
  nom?: string;
}

export interface AddSlotInput {
  menuId: string;
  recetteId?: string;
  descriptionLibre?: string;
  /** Optionnel — si absent, la recette est "libre" dans la semaine */
  jour?: JourMenu;
  /** Optionnel */
  repas?: RepasMenu;
}

export interface UpdateSlotInput {
  slotId: string;
  jour?: JourMenu | null;   // null pour effacer le jour
  repas?: RepasMenu | null; // null pour effacer le repas
  recetteId?: string | null;
  descriptionLibre?: string | null;
  statut?: 'prevue' | 'realisee';
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const MenuService = {

  /**
   * Crée un nouveau menu pour la semaine contenant `dateReference` (défaut : aujourd'hui).
   * Vérifie qu'aucun menu non archivé ne couvre déjà cette semaine.
   */
  async createMenu(input: CreateMenuInput = {}): Promise<Menu> {
    const ref = input.dateReference ?? new Date();
    const lundi = getLundi(ref);
    const dimanche = getDimanche(ref);
    const dateDebut = toISO(lundi);
    const dateFin = toISO(dimanche);

    // Nom auto : "Menu semaine du DD/MM" si non fourni
    const nom = input.nom?.trim() || `Menu du ${lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

    const menu = newEntity<Menu>({
      semaine: 1 as const,
      nom,
      dateDebut,
      dateFin,
      valide: false,
      archive: false,
    });

    await db.menus.add(menu);
    return menu;
  },

  /**
   * Ajoute une recette (ou une description libre) au menu.
   * Le jour est optionnel — si absent, la recette est "prévue dans la semaine".
   */
  async addSlot(input: AddSlotInput): Promise<MenuSlot> {
    if (!input.recetteId && !input.descriptionLibre) {
      throw new Error('Un slot doit avoir une recette ou une description libre');
    }

    const slot = newEntity<MenuSlot>({
      menu: input.menuId,
      recette: input.recetteId,
      descriptionLibre: input.descriptionLibre,
      jour: input.jour,
      repas: input.repas,
      statut: 'prevue' as const,
    });

    await db.menuSlots.add(slot);
    return slot;
  },

  /**
   * Met à jour un slot existant.
   * Passer `null` sur un champ optionnel l'efface.
   */
  async updateSlot(input: UpdateSlotInput): Promise<void> {
    const changes: Partial<MenuSlot> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if ('jour' in input) {
      changes.jour = input.jour ?? undefined;
    }
    if ('repas' in input) {
      changes.repas = input.repas ?? undefined;
    }
    if ('recetteId' in input) {
      changes.recette = input.recetteId ?? undefined;
    }
    if ('descriptionLibre' in input) {
      changes.descriptionLibre = input.descriptionLibre ?? undefined;
    }
    if (input.statut) {
      changes.statut = input.statut;
    }

    await db.menuSlots.update(input.slotId, changes);
  },

  /**
   * Marque une recette comme réalisée.
   */
  async marquerRealisee(slotId: string): Promise<void> {
    await db.menuSlots.update(slotId, {
      statut: 'realisee',
      updatedAt: new Date(),
    });
  },

  /**
   * Supprime un slot (soft delete via archive + deletedAt).
   */
  async removeSlot(slotId: string): Promise<void> {
    await db.menuSlots.update(slotId, {
      archive: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Valide un menu → déclenche A-01 (génération liste de courses).
   */
  async validateMenu(menuId: string): Promise<void> {
    const menu = await db.menus.get(menuId);
    if (!menu) throw new Error(`Menu introuvable : ${menuId}`);

    await db.menus.update(menuId, {
      valide: true,
      updatedAt: new Date(),
    });

    const updatedMenu = { ...menu, valide: true };
    emit('menu.validated', { menu: updatedMenu });
  },

  /**
   * Dévalide un menu (pour pouvoir le modifier après validation).
   */
  async invalidateMenu(menuId: string): Promise<void> {
    await db.menus.update(menuId, {
      valide: false,
      updatedAt: new Date(),
    });
  },

  /**
   * Archive un menu et tous ses slots.
   */
  async archiveMenu(menuId: string): Promise<void> {
    const now = new Date();
    await db.menus.update(menuId, { archive: true, deletedAt: now, updatedAt: now });
    const slots = await db.menuSlots.where('menu').equals(menuId).toArray();
    await Promise.all(
      slots.map((s) =>
        db.menuSlots.update(s.id, { archive: true, deletedAt: now, updatedAt: now })
      )
    );
  },

  /**
   * Récupère tous les menus non archivés, triés du plus récent au plus ancien.
   */
  async getMenus(): Promise<Menu[]> {
    return db.menus
      .filter((m) => !m.archive && !m.deletedAt)
      .toArray()
      .then((list) => list.sort((a, b) => b.dateDebut.localeCompare(a.dateDebut)));
  },

  /**
   * Retourne le menu (validé ou non) couvrant aujourd'hui.
   * Si aucun n'existe, en crée un automatiquement pour la semaine courante.
   */
  async getMenuActifOuCreer(): Promise<Menu> {
    const today = toISODate(new Date());
    const menu = await db.menus
      .filter(
        (m) =>
          !m.archive &&
          !m.deletedAt &&
          m.dateDebut <= today &&
          (m.dateFin == null || m.dateFin >= today)
      )
      .first();
    if (menu) return menu;
    return this.createMenu();
  },

  /**
   * Crée ou met à jour le slot identifié par (menuId, jour, repas).
   * Si un slot existant correspond, il est mis à jour ; sinon, un nouveau slot est créé.
   */
  async upsertSlot(input: AddSlotInput): Promise<MenuSlot> {
    if (input.jour && input.repas) {
      const existing = await db.menuSlots
        .filter(
          (s) =>
            s.menu === input.menuId &&
            s.jour === input.jour &&
            s.repas === input.repas &&
            !s.archive &&
            !s.deletedAt
        )
        .first();
      if (existing) {
        const changes: Partial<MenuSlot> & { updatedAt: Date } = {
          updatedAt: new Date(),
          recette: input.recetteId,
          descriptionLibre: input.descriptionLibre,
          statut: 'prevue' as const,
        };
        await db.menuSlots.update(existing.id, changes);
        return { ...existing, ...changes };
      }
    }
    return this.addSlot(input);
  },

  /**
   * Récupère les slots d'un menu, sans les archivés.
   * Résout les recettes associées.
   */
  async getSlotsWithRecettes(menuId: string) {
    const slots = await db.menuSlots
      .where('menu')
      .equals(menuId)
      .filter((s) => !s.archive && !s.deletedAt)
      .toArray();

    const recetteIds = [...new Set(slots.map((s) => s.recette).filter(Boolean) as string[])];
    const recettes = recetteIds.length
      ? await db.recettes.where('id').anyOf(recetteIds).toArray()
      : [];
    const recettesMap = Object.fromEntries(recettes.map((r) => [r.id, r]));

    return slots.map((s) => ({
      ...s,
      recetteResolue: s.recette ? recettesMap[s.recette] : undefined,
    }));
  },
};
