/**
 * FAMILY OS — MaisonService
 * src/modules/maison/services/MaisonService.ts
 *
 * CRUD Pièces + gestion du score propreté.
 * Règle A-13 : dégradation delta (nb jours écoulés × taux) — appelée depuis providers.tsx.
 */

import { db } from '../../../core/db/database';
import { newEntity, withUpdate } from '../../../core/db/helpers';
import { emit } from '../../../core/automation/engine';
import { daysBetween } from '../../../shared/utils/formatDate';
import type { Piece } from '@shared/types/modules';

export interface PieceInput {
  nom: string;
  icone?: string;
  tauxDegradation?: number; // points/jour
}

export const MaisonService = {

  // ── Pièces ──────────────────────────────────────────────────────────────────

  async addPiece(input: PieceInput): Promise<string> {
    const piece = newEntity<Piece>({
      nom: input.nom.trim(),
      icone: input.icone,
      scoreProprety: 100,
      tauxDegradation: input.tauxDegradation ?? 3,
      actif: true,
    });
    await db.pieces.add(piece);
    return piece.id;
  },

  async updatePiece(id: string, input: Partial<PieceInput>): Promise<void> {
    const patch: Partial<Piece> = {};
    if (input.nom !== undefined) patch.nom = input.nom.trim();
    if (input.icone !== undefined) patch.icone = input.icone;
    if (input.tauxDegradation !== undefined) patch.tauxDegradation = input.tauxDegradation;
    await db.pieces.update(id, withUpdate<Piece>(patch));
  },

  async desactiverPiece(id: string): Promise<void> {
    await db.pieces.update(id, withUpdate<Piece>({ actif: false }));
    // Déclenche A-40 : archive en cascade tâches, projets, wishlist de cette pièce
    emit('entity.master_archive_requested', { tableName: 'pieces', entityId: id })
  },

  /** Remet le score à 100 et met à jour dernierEntretien. */
  async marquerEntretenue(id: string): Promise<void> {
    await db.pieces.update(id, withUpdate<Piece>({
      scoreProprety: 100,
      dernierEntretien: new Date(),
      etatGeneral: 'tres_propre',
    }));
  },

  /** Ajuste manuellement le score d'une pièce (0–100). */
  async setScore(id: string, score: number): Promise<void> {
    const s = Math.max(0, Math.min(100, Math.round(score)));
    await db.pieces.update(id, withUpdate<Piece>({
      scoreProprety: s,
      etatGeneral: scoreToEtat(s),
    }));
  },

  /**
   * A-13 — Dégradation delta.
   * Appelée depuis providers.tsx à chaque ouverture.
   * Calcule nb jours depuis last run, applique taux × nbJours à chaque pièce.
   */
  async appliquerDegradation(): Promise<void> {
    const cle = 'maison.lastDegradation';
    const param = await db.parametresSync.where('cle').equals(cle).first();
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    let nbJours = 1;
    if (param) {
      const lastDate = new Date(param.valeur);
      nbJours = daysBetween(lastDate, today);
      if (nbJours <= 0) return; // déjà appliqué aujourd'hui
    }

    const pieces = await db.pieces.filter(p => p.actif && !p.deletedAt).toArray();

    await Promise.all(
      pieces.map(async (p) => {
        const taux = p.tauxDegradation ?? 3;
        const nouveau = Math.max(0, p.scoreProprety - taux * nbJours);
        await db.pieces.update(p.id, withUpdate<Piece>({
          scoreProprety: nouveau,
          etatGeneral: scoreToEtat(nouveau),
        }));
      })
    );

    // Mettre à jour la date de dernière exécution
    const now = new Date();
    if (param) {
      await db.parametresSync.update(param.id, {
        valeur: todayStr,
        derniereModification: now,
        updatedAt: now,
      });
    } else {
      await db.parametresSync.add({
        id: crypto.randomUUID(),
        cle,
        valeur: todayStr,
        derniereModification: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  },

  /**
   * Lance une nouvelle session de grand ménage :
   * — décoche toutes les tâches maison
   * — remet tous les scores à 0
   * — enregistre la date de lancement
   */
  async lancerGrandMenage(): Promise<void> {
    const now = new Date();
    // Décoche toutes les tâches maison
    const taches = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison')
      .toArray();
    await Promise.all(taches.map(t =>
      db.taches.update(t.id, withUpdate({ statut: 'a_faire', completeeLe: undefined }))
    ));
    // Remet tous les scores à 0
    const pieces = await db.pieces.filter(p => p.actif && !p.deletedAt).toArray();
    await Promise.all(pieces.map(p =>
      db.pieces.update(p.id, withUpdate<Piece>({ scoreProprety: 0, etatGeneral: 'urgent' }))
    ));
    // Enregistre la date de lancement
    const cle = 'grandMenage.dernierLancement';
    const valeur = now.toISOString().slice(0, 10);
    const param = await db.parametresSync.where('cle').equals(cle).first();
    if (param) {
      await db.parametresSync.update(param.id, { valeur, derniereModification: now, updatedAt: now });
    } else {
      await db.parametresSync.add({ id: crypto.randomUUID(), cle, valeur, derniereModification: now, createdAt: now, updatedAt: now });
    }
  },

  /** Réinitialise une seule pièce : décoche ses tâches + score à 0. */
  async resetPiece(pieceId: string): Promise<void> {
    const taches = await db.taches
      .filter(t => !t.archive && !t.deletedAt && t.moduleOrigine === 'maison' && t.pieceAssociee === pieceId)
      .toArray();
    await Promise.all(taches.map(t =>
      db.taches.update(t.id, withUpdate({ statut: 'a_faire', completeeLe: undefined }))
    ));
    await db.pieces.update(pieceId, withUpdate<Piece>({ scoreProprety: 0, etatGeneral: 'urgent' }));
  },

} as const;

// ── Helpers exportés (réutilisés dans les composants) ─────────────────────────

export function scoreToEtat(score: number): Piece['etatGeneral'] {
  if (score >= 80) return 'tres_propre';
  if (score >= 55) return 'propre';
  if (score >= 30) return 'a_entretenir';
  return 'urgent';
}

export function etatLabel(etat: Piece['etatGeneral'] | undefined): string {
  switch (etat) {
    case 'tres_propre': return 'Très propre';
    case 'propre': return 'Propre';
    case 'a_entretenir': return 'À entretenir';
    case 'urgent': return 'Urgent !';
    default: return '—';
  }
}

export function etatColor(etat: Piece['etatGeneral'] | undefined): string {
  switch (etat) {
    case 'tres_propre': return '#86EFAC'; // vert
    case 'propre': return '#93C5FD';     // bleu
    case 'a_entretenir': return '#FCD34D'; // jaune
    case 'urgent': return '#FCA5A5';     // rouge
    default: return '#D1D5DB';
  }
}
