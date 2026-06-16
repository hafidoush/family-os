/**
 * FAMILY OS — Service Réunions Famille
 */

import { db } from '@core/db/database';
import { newEntity, withUpdate } from '@core/db/helpers';
import type { ReunionFamille } from '@shared/types/modules';
import type { ReunionFormData } from '../types/familleTypes';

export const reunionService = {
  async create(data: ReunionFormData): Promise<string> {
    const reunion = newEntity<ReunionFamille>({
      date: data.date,
      heure: data.heure,
      agenda: data.agenda,
      participantIds: data.participantIds,
      resume: data.resume,
      humeursSaisies: [],
      terminee: false,
    });
    await db.reunionsFamille.add(reunion as unknown as import("@shared/types").ReunionFamille);
    return reunion.id;
  },

  async terminer(id: string, resume?: string): Promise<void> {
    await db.reunionsFamille.update(id, withUpdate({ terminee: true, resume }));
  },

  async ajouterHumeur(reunionId: string, humeurId: string): Promise<void> {
    const reunion = await db.reunionsFamille.get(reunionId);
    if (!reunion) return;
    const humeurs = [...(reunion.humeursSaisies ?? [])];
    if (!humeurs.includes(humeurId)) humeurs.push(humeurId);
    await db.reunionsFamille.update(reunionId, withUpdate({ humeursSaisies: humeurs }));
  },

  async updateResume(id: string, resume: string): Promise<void> {
    await db.reunionsFamille.update(id, withUpdate({ resume }));
  },
};
