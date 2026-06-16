/**
 * FAMILY OS — Service Souvenirs
 */

import { db } from '@core/db/database';
import { newEntity, withUpdate, softDeleteFields } from '@core/db/helpers';
import type { Souvenir } from '@shared/types/modules';
import type { SouvenirFormData } from '../types/familleTypes';

export const souvenirService = {
  async create(data: SouvenirFormData): Promise<string> {
    const souvenir = newEntity<Souvenir>({
      titre: data.titre,
      description: data.description,
      date: data.date,
      membresAssocies: data.membresAssocies,
      tags: data.tags ?? [],
      type: data.type,
      photosBase64: data.photosBase64 ?? [],
      photos: [],
      archive: false,
    });
    await db.souvenirs.add(souvenir);
    return souvenir.id;
  },

  async update(id: string, data: Partial<SouvenirFormData>): Promise<void> {
    const patch: Partial<Souvenir> = {};
    if (data.titre !== undefined) patch.titre = data.titre;
    if (data.description !== undefined) patch.description = data.description;
    if (data.date !== undefined) patch.date = data.date;
    if (data.membresAssocies !== undefined) patch.membresAssocies = data.membresAssocies;
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.type !== undefined) patch.type = data.type;
    if (data.photosBase64 !== undefined) patch.photosBase64 = data.photosBase64;
    await db.souvenirs.update(id, withUpdate(patch));
  },

  async delete(id: string): Promise<void> {
    await db.souvenirs.update(id, withUpdate(softDeleteFields()));
  },
};
