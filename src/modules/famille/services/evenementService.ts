/**
 * FAMILY OS — Service Événements Famille
 * Toutes les écritures Dexie passent par ce service (règle invariante)
 */

import { db } from '@core/db/database';
import { newEntity, withUpdate, softDeleteFields } from '@core/db/helpers';
import type { Evenement, Tache } from '@shared/types/entities';
import type { EvenementFormData } from '../types/familleTypes';

export const evenementService = {
  async create(data: EvenementFormData): Promise<string> {
    const evenement = newEntity<Evenement>({
      titre: data.titre,
      description: data.description,
      type: data.type,
      couleur: data.couleur,
      dateDebut: new Date(data.dateDebut),
      dateFin: data.dateFin ? new Date(data.dateFin) : undefined,
      journeeEntiere: data.journeeEntiere,
      lieu: data.lieu,
      recurrence: data.recurrence,
      frequence: data.recurrence ? data.frequence : undefined,
      regleRecurrence: data.recurrence ? data.regleRecurrence : undefined,
      alerteMinutes: data.alerteMinutes,
      personnesAssociees: data.personnesAssociees,
      notes: data.notes,
      moduleOrigine: 'famille',
      contexteMedical: data.contexteMedical,
      archive: false,
    });
    await db.evenements.add(evenement);

    // Créer les sous-tâches liées
    if (data.sousTaches && data.sousTaches.length > 0) {
      await evenementService._syncSousTaches(evenement.id, data.sousTaches);
    }

    return evenement.id;
  },

  async update(id: string, data: Partial<EvenementFormData>): Promise<void> {
    const patch: Partial<Evenement> = {};
    if (data.titre !== undefined) patch.titre = data.titre;
    if (data.description !== undefined) patch.description = data.description;
    if (data.type !== undefined) patch.type = data.type;
    if (data.couleur !== undefined) patch.couleur = data.couleur;
    if (data.dateDebut !== undefined) patch.dateDebut = new Date(data.dateDebut);
    if (data.dateFin !== undefined) patch.dateFin = data.dateFin ? new Date(data.dateFin) : undefined;
    if (data.journeeEntiere !== undefined) patch.journeeEntiere = data.journeeEntiere;
    if (data.lieu !== undefined) patch.lieu = data.lieu;
    if (data.recurrence !== undefined) patch.recurrence = data.recurrence;
    if (data.frequence !== undefined) patch.frequence = data.frequence;
    if (data.regleRecurrence !== undefined) patch.regleRecurrence = data.regleRecurrence;
    if (data.alerteMinutes !== undefined) patch.alerteMinutes = data.alerteMinutes;
    if (data.personnesAssociees !== undefined) patch.personnesAssociees = data.personnesAssociees;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.contexteMedical !== undefined) patch.contexteMedical = data.contexteMedical;

    await db.evenements.update(id, withUpdate(patch));

    if (data.sousTaches !== undefined) {
      await evenementService._syncSousTaches(id, data.sousTaches);
    }
  },

  async delete(id: string): Promise<void> {
    await db.evenements.update(id, withUpdate(softDeleteFields()));
    // Archiver les sous-tâches liées
    const liees = await db.taches.filter(t => t.evenementAssocie === id && !t.archive).toArray();
    for (const t of liees) {
      await db.taches.update(t.id, withUpdate({ archive: true } as Partial<Tache>));
    }
  },

  async getSousTaches(evenementId: string): Promise<Tache[]> {
    return db.taches
      .filter(t => t.evenementAssocie === evenementId && !t.archive && !t.deletedAt)
      .toArray();
  },

  async _syncSousTaches(
    evenementId: string,
    sousTaches: { titre: string; fait: boolean; id?: string }[]
  ): Promise<void> {
    const existing = await db.taches
      .filter(t => t.evenementAssocie === evenementId && !t.archive)
      .toArray();
    const existingIds = new Set(existing.map(t => t.id));

    for (const st of sousTaches) {
      if (st.id && existingIds.has(st.id)) {
        // Mettre à jour
        await db.taches.update(st.id, withUpdate({
          titre: st.titre,
          statut: st.fait ? 'fait' : 'a_faire',
        } as Partial<Tache>));
        existingIds.delete(st.id);
      } else {
        // Créer
        const tache = newEntity<Tache>({
          titre: st.titre,
          statut: st.fait ? 'fait' : 'a_faire',
          moduleOrigine: 'famille',
          recurrence: false,
          archive: false,
          evenementAssocie: evenementId,
        });
        await db.taches.add(tache);
      }
    }

    // Archiver les sous-tâches supprimées
    for (const orphanId of existingIds) {
      await db.taches.update(orphanId, withUpdate({ archive: true } as Partial<Tache>));
    }
  },
};
