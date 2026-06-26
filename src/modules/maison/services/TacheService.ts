/**
 * FAMILY OS — TacheService (contexte Maison)
 * src/modules/maison/services/TacheService.ts
 *
 * Gère les tâches d'entretien liées aux pièces.
 * Les tâches sont l'entité centrale Tache (entities.ts) avec moduleOrigine = 'maison'.
 * La complétion d'une tâche d'entretien ajuste le scoreProprety de la pièce.
 */

import { db } from '../../../core/db/database';
import { newEntity, softDeleteFields, withUpdate } from '../../../core/db/helpers';
import { emit } from '../../../core/automation/engine';
import { MaisonService, scoreToEtat } from './MaisonService';
import type { Tache, PrioriteTache, FrequenceTache, JourSemaine } from '@shared/types/entities';
import type { MenagePatch } from '../../menage/engine/menageEngine';

export interface TacheEntretienInput {
  titre: string;
  pieceId?: string;
  projetId?: string;
  priorite?: PrioriteTache;
  dateEcheance?: Date;
  recurrence: boolean;
  frequence?: FrequenceTache;
  joursSemaine?: JourSemaine[];
  dureeEstimee?: number; // minutes
  description?: string;
  impactScore?: number; // points de propreté restaurés à la complétion (défaut 20)
  dateReference?: Date; // ancre pour le calcul de la prochaine échéance
  completeeLe?: Date;   // dernière réalisation (override manuel depuis le formulaire)
  // Moteur Ménage
  menageDifficulty?: 1 | 2 | 3;
  menageVisualImpact?: 1 | 2 | 3;
  menageHealthImportance?: 1 | 2 | 3;
}

/** Recalcule le score d'une pièce en fonction du ratio de tâches complétées. */
async function recalculerScorePiece(pieceId: string): Promise<void> {
  const taches = await db.taches
    .filter(t => !t.archive && !t.deletedAt && t.pieceAssociee === pieceId && t.moduleOrigine === 'maison')
    .toArray();
  if (taches.length === 0) return;
  const completees = taches.filter(t => t.statut === 'fait').length;
  const score = Math.round((completees / taches.length) * 100);
  await db.pieces.update(pieceId, withUpdate({
    scoreProprety: score,
    etatGeneral: scoreToEtat(score),
    ...(completees === taches.length ? { dernierEntretien: new Date() } : {}),
  }));
}

export const TacheService = {

  async addTache(input: TacheEntretienInput): Promise<string> {
    const tache = newEntity<Tache>({
      titre: input.titre.trim(),
      statut: input.completeeLe ? 'fait' : 'a_faire',
      moduleOrigine: 'maison',
      pieceAssociee: input.pieceId,
      projetAssocie: input.projetId,
      priorite: input.priorite ?? 'normale',
      dateEcheance: input.dateEcheance,
      recurrence: input.recurrence,
      frequence: input.frequence,
      joursSemaine: input.joursSemaine,
      dureeEstimee: input.dureeEstimee,
      description: input.description?.trim(),
      dateReference: input.dateReference,
      completeeLe: input.completeeLe,
      archive: false,
      // Moteur Ménage — valeurs par défaut à la création
      missedCount: 0,
      skippedUntil: null,
      menageDifficulty:       input.menageDifficulty       ?? 2,
      menageVisualImpact:     input.menageVisualImpact     ?? 2,
      menageHealthImportance: input.menageHealthImportance ?? 1,
    });
    await db.taches.add(tache);
    return tache.id;
  },

  async updateTache(id: string, input: Partial<TacheEntretienInput>): Promise<void> {
    const patch: Partial<Tache> = {};
    if (input.titre !== undefined) patch.titre = input.titre.trim();
    if (input.pieceId !== undefined) patch.pieceAssociee = input.pieceId;
    if (input.projetId !== undefined) patch.projetAssocie = input.projetId;
    if (input.priorite !== undefined) patch.priorite = input.priorite;
    if (input.dateEcheance !== undefined) patch.dateEcheance = input.dateEcheance;
    if (input.recurrence !== undefined) patch.recurrence = input.recurrence;
    if (input.frequence !== undefined) patch.frequence = input.frequence;
    if (input.joursSemaine !== undefined) patch.joursSemaine = input.joursSemaine;
    if (input.dureeEstimee !== undefined) patch.dureeEstimee = input.dureeEstimee;
    if (input.description !== undefined) patch.description = input.description?.trim();
    if (input.dateReference !== undefined) patch.dateReference = input.dateReference;
    if (input.completeeLe !== undefined) {
      patch.completeeLe = input.completeeLe;
      patch.statut = 'fait';
    }
    if (input.menageDifficulty       !== undefined) patch.menageDifficulty       = input.menageDifficulty;
    if (input.menageVisualImpact     !== undefined) patch.menageVisualImpact     = input.menageVisualImpact;
    if (input.menageHealthImportance !== undefined) patch.menageHealthImportance = input.menageHealthImportance;
    await db.taches.update(id, withUpdate<Tache>(patch));
  },

  /**
   * Complète une tâche d'entretien.
   * Recalcule le score de la pièce en fonction du taux de tâches complétées.
   * Émet tache.completed_recurrent ou tache.completed_nonrecurrent (A-29 / A-30).
   */
  async completerTache(id: string): Promise<void> {
    const tache = await db.taches.get(id);
    if (!tache) return;

    await db.taches.update(id, withUpdate<Tache>({
      statut: 'fait',
      completeeLe: new Date(),
    }));

    if (tache.pieceAssociee) {
      await recalculerScorePiece(tache.pieceAssociee);
    }

    const event = tache.recurrence ? 'tache.completed_recurrent' : 'tache.completed_nonrecurrent';
    emit(event, { tacheId: id, moduleOrigine: 'maison' });
  },

  async rouvrir(id: string): Promise<void> {
    const tache = await db.taches.get(id);
    await db.taches.update(id, withUpdate<Tache>({ statut: 'a_faire', completeeLe: undefined }));
    if (tache?.pieceAssociee) {
      await recalculerScorePiece(tache.pieceAssociee);
    }
  },

  async deleteTache(id: string): Promise<void> {
    await db.taches.update(id, softDeleteFields());
  },

  /**
   * Applique un patch moteur Ménage (missedCount + skippedUntil).
   * Appelé après computeMissedUpdates() ou computeSkipPatch().
   */
  async applyMenagePatch(patch: MenagePatch): Promise<void> {
    await db.taches.update(patch.id, withUpdate<Tache>({
      missedCount:  patch.missedCount,
      skippedUntil: patch.skippedUntil ?? undefined,
    }));
  },

  /**
   * Traite les tâches non réalisées de la veille.
   * À appeler une fois par jour au démarrage de l'app.
   * Protégé par localStorage pour éviter les doubles exécutions.
   */
  async processMissedTasks(): Promise<void> {
    const LS_KEY = 'menage_missed_processed'
    const todayISO = new Date().toISOString().split('T')[0]
    try {
      if (localStorage.getItem(LS_KEY) === todayISO) return
    } catch { /* */ }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const all = await db.taches
      .filter(t => !t.archive && !(t as Tache & { deletedAt?: Date }).deletedAt
        && t.moduleOrigine === 'maison'
        && t.recurrence === true)
      .toArray()

    const { computeMissedUpdates } = await import('../../menage/engine/menageEngine')
    const patches = computeMissedUpdates(all, yesterday)

    for (const patch of patches) {
      await TacheService.applyMenagePatch(patch)
    }

    try {
      localStorage.setItem(LS_KEY, todayISO)
    } catch { /* */ }
  },

  /**
   * Réinitialise toutes les tâches ménage à aujourd'hui (après grand ménage, déménagement…).
   * Accessible depuis les paramètres du module uniquement.
   */
  async resetMenageTasks(): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const all = await db.taches
      .filter(t => !t.archive && t.moduleOrigine === 'maison' && t.recurrence === true)
      .toArray()

    for (const t of all) {
      await db.taches.update(t.id, withUpdate<Tache>({
        completeeLe:  today,
        statut:       'fait',
        missedCount:  0,
        skippedUntil: undefined,
      }))
    }
  },

} as const;
