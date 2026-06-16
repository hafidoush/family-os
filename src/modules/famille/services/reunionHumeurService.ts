/**
 * FAMILY OS — reunionHumeurService
 * Gère la saisie d'humeur dans le contexte d'une réunion famille.
 *
 * Règles respectées :
 *  - Écriture Dexie uniquement ici (jamais dans un composant)
 *  - newEntity() pour les champs d'audit
 *  - Lien réunion via reunionService.ajouterHumeur()
 */

import { db } from '@core/db/database';
import { newEntity, withUpdate } from '@core/db/helpers';
import { toISODate } from '@shared/utils/formatDate';
import type { Humeur, ValeurHumeur } from '@shared/types';

export const reunionHumeurService = {
  /**
   * Saisit l'humeur d'un membre lors d'une réunion.
   * - Crée l'entrée dans db.humeurs (source = 'reunion_famille')
   * - Lie l'humeur à la réunion via humeursSaisies[]
   * - Idempotent : si une humeur du même membre existe déjà
   *   pour cette réunion, elle est mise à jour plutôt que dupliquée.
   */
  async saisirHumeur(
    reunionId: string,
    membreId: string,
    valeur: ValeurHumeur,
    noteLibre?: string,
  ): Promise<string> {
    const reunion = await db.reunionsFamille.get(reunionId);
    if (!reunion) throw new Error(`Réunion introuvable : ${reunionId}`);

    const today = toISODate(new Date());

    // Vérifier si une humeur existe déjà pour ce membre dans cette réunion
    const humeursExistantes = reunion.humeursSaisies ?? [];
    const humeursMembre = await db.humeurs
      .where('id').anyOf(humeursExistantes)
      .and(h => h.membre === membreId)
      .toArray();

    if (humeursMembre.length > 0) {
      // Mise à jour de l'humeur existante
      const existing = humeursMembre[0];
      await db.humeurs.update(existing.id, withUpdate({ valeur, noteLibre }));
      return existing.id;
    }

    // Création d'une nouvelle humeur
    const humeur = newEntity<Humeur>({
      membre: membreId,
      valeur,
      noteLibre: noteLibre || undefined,
      date: today,
      heure: new Date().toTimeString().slice(0, 5),
      source: 'reunion_famille',
    });

    await db.humeurs.add(humeur as unknown as import("@shared/types").Humeur);

    // Lier à la réunion
    const humeursMAJ = [...humeursExistantes, humeur.id];
    await db.reunionsFamille.update(reunionId, withUpdate({ humeursSaisies: humeursMAJ }));

    return humeur.id;
  },

  /**
   * Récupère les humeurs déjà saisies pour une réunion,
   * indexées par membreId pour usage rapide dans le composant.
   */
  async getHumeursReunion(reunionId: string): Promise<Record<string, Humeur>> {
    const reunion = await db.reunionsFamille.get(reunionId);
    if (!reunion?.humeursSaisies?.length) return {};

    const humeurs = await db.humeurs
      .where('id').anyOf(reunion.humeursSaisies)
      .toArray();

    return Object.fromEntries(humeurs.map(h => [h.membre, h])) as unknown as Record<string, Humeur>;
  },
};
