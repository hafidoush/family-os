/**
 * FAMILY OS — ProjetService
 * src/modules/maison/services/ProjetService.ts
 *
 * CRUD ProjetMaison.
 * La progression est calculée à la volée (D-03) :
 *   taches liées → nb faites / nb total → pourcentage.
 */

import { db } from '../../../core/db/database';
import { newEntity, softDeleteFields, withUpdate } from '../../../core/db/helpers';
import { emit } from '../../../core/automation/engine';
import type { ProjetMaison } from '@shared/types/modules';

export interface ProjetInput {
  nom: string;
  description?: string;
  pieceId?: string;
  statut?: ProjetMaison['statut'];
  dateDebut?: string;
  dateCible?: string;
  budgetAssocie?: string;
}

export const ProjetService = {

  async addProjet(input: ProjetInput): Promise<string> {
    const projet = newEntity<ProjetMaison>({
      nom: input.nom.trim(),
      description: input.description?.trim(),
      pieceAssociee: input.pieceId,
      statut: input.statut ?? 'a_faire',
      dateDebut: input.dateDebut,
      dateCible: input.dateCible,
      budgetAssocie: input.budgetAssocie,
      archive: false,
    });
    await db.projetsMaison.add(projet);
    return projet.id;
  },

  async updateProjet(id: string, input: Partial<ProjetInput>): Promise<void> {
    const patch: Partial<ProjetMaison> = {};
    if (input.nom !== undefined) patch.nom = input.nom.trim();
    if (input.description !== undefined) patch.description = input.description?.trim();
    if (input.pieceId !== undefined) patch.pieceAssociee = input.pieceId;
    if (input.statut !== undefined) patch.statut = input.statut;
    if (input.dateDebut !== undefined) patch.dateDebut = input.dateDebut;
    if (input.dateCible !== undefined) patch.dateCible = input.dateCible;
    if (input.budgetAssocie !== undefined) patch.budgetAssocie = input.budgetAssocie;
    await db.projetsMaison.update(id, withUpdate<ProjetMaison>(patch));
  },

  async changerStatut(id: string, statut: ProjetMaison['statut']): Promise<void> {
    await db.projetsMaison.update(id, withUpdate<ProjetMaison>({ statut }));
    if (statut === 'termine') {
      emit('projet.completed', { projetId: id });
    }
  },

  async deleteProjet(id: string): Promise<void> {
    await db.projetsMaison.update(id, softDeleteFields());
    // Déclenche A-40 : archive en cascade les tâches du projet
    emit('entity.master_archive_requested', { tableName: 'projetsMaison', entityId: id })
  },

  /**
   * Calcule la progression d'un projet (D-03 — jamais stocké).
   * Retourne 0–100.
   */
  async calculerProgression(projetId: string): Promise<number> {
    const taches = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.projetAssocie === projetId)
      .toArray();
    if (taches.length === 0) return 0;
    const faites = taches.filter(t => t.statut === 'fait').length;
    return Math.round((faites / taches.length) * 100);
  },

} as const;
