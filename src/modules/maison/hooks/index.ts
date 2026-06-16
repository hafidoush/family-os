/**
 * FAMILY OS — Hooks Module Maison
 * src/modules/maison/hooks/
 *
 * Un hook = un fichier en production. Ici regroupés pour la livraison.
 * Tous useLiveQuery — jamais d'appel Dexie direct en composant (D-07).
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../core/db/database';
import { scoreToEtat } from '../services/MaisonService';
import type { Piece } from '@shared/types/modules';
import type { Tache } from '@shared/types/entities';

// ─────────────────────────────────────────────────────────────────────────────
// usePieces — toutes les pièces actives, triées par etatGeneral (urgent en tête)
// ─────────────────────────────────────────────────────────────────────────────

const ETAT_ORDRE: Record<string, number> = {
  urgent: 0, a_entretenir: 1, propre: 2, tres_propre: 3,
};

export function usePieces() {
  return useLiveQuery(async () => {
    const pieces = await db.pieces
      .filter(p => p.actif && !p.deletedAt)
      .toArray();
    return pieces.sort((a, b) => {
      const etatA = a.etatGeneral ?? scoreToEtat(a.scoreProprety);
      const etatB = b.etatGeneral ?? scoreToEtat(b.scoreProprety);
      const oa = etatA ? (ETAT_ORDRE[etatA] ?? 4) : 4;
      const ob = etatB ? (ETAT_ORDRE[etatB] ?? 4) : 4;
      if (oa !== ob) return oa - ob;
      return a.scoreProprety - b.scoreProprety; // plus sale en tête à urgence égale
    });
  }, [], []);
}

// ─────────────────────────────────────────────────────────────────────────────
// usePieceById
// ─────────────────────────────────────────────────────────────────────────────

export function usePieceById(id: string | null): import('@shared/types').Piece | undefined {
  return useLiveQuery(
    () => (id ? db.pieces.get(id) : Promise.resolve(undefined)),
    [id]
  ) as import('@shared/types').Piece | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// useTachesMaison — tâches d'entretien, avec filtres optionnels
// ─────────────────────────────────────────────────────────────────────────────

interface TachesFiltres {
  pieceId?: string | null;
  statut?: 'toutes' | 'a_faire' | 'fait';
  projetId?: string | null;
}

export function useTachesMaison(filtres: TachesFiltres = {}) {
  return useLiveQuery(async () => {
    const taches = await db.taches
      .filter(t =>
        !t.archive &&
        !t.deletedAt &&
        t.moduleOrigine === 'maison' &&
        (filtres.pieceId ? t.pieceAssociee === filtres.pieceId : true) &&
        (filtres.projetId ? t.projetAssocie === filtres.projetId : true) &&
        (filtres.statut && filtres.statut !== 'toutes' ? t.statut === filtres.statut : true)
      )
      .toArray();

    // Tri : urgentes d'abord, puis par date d'échéance
    return taches.sort((a, b) => {
      const prio: Record<string, number> = { urgente: 0, haute: 1, normale: 2, basse: 3 };
      const dp = (prio[a.priorite ?? 'normale'] ?? 2) - (prio[b.priorite ?? 'normale'] ?? 2);
      if (dp !== 0) return dp;
      if (a.dateEcheance && b.dateEcheance) {
        return new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime();
      }
      if (a.dateEcheance) return -1;
      if (b.dateEcheance) return 1;
      return 0;
    });
  }, [filtres.pieceId, filtres.statut, filtres.projetId], []);
}

// ─────────────────────────────────────────────────────────────────────────────
// useTachesUrgentes — tâches en retard ou échéance aujourd'hui (pour l'overview)
// ─────────────────────────────────────────────────────────────────────────────

export function useTachesUrgentes() {
  return useLiveQuery(async () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return db.taches
      .filter(t =>
        !t.archive &&
        !t.deletedAt &&
        t.moduleOrigine === 'maison' &&
        t.statut === 'a_faire' &&
        !!t.dateEcheance &&
        new Date(t.dateEcheance) <= today
      )
      .toArray();
  }, [], []);
}

// ─────────────────────────────────────────────────────────────────────────────
// useProjets — projets maison actifs avec leur progression calculée
// ─────────────────────────────────────────────────────────────────────────────

export function useProjets() {
  return useLiveQuery(async () => {
    const projets = await db.projetsMaison
      .filter(p => !p.archive && !p.deletedAt)
      .toArray();

    // Calcul de progression pour chaque projet (D-03)
    const enrichis = await Promise.all(
      projets.map(async (p) => {
        const taches = await db.taches
          .filter(t => !t.archive && !t.deletedAt && t.projetAssocie === p.id)
          .toArray();
        const total = taches.length;
        const faites = taches.filter(t => t.statut === 'fait').length;
        const progression = total === 0 ? 0 : Math.round((faites / total) * 100);
        // Pièce associée (pour affichage)
        const piece = p.pieceAssociee
          ? await db.pieces.get(p.pieceAssociee)
          : undefined;
        return { projet: p, progression, piece: piece ?? null, nbTaches: total, nbFaites: faites };
      })
    );

    // Tri : en_cours d'abord, puis a_faire, puis termine
    const ordre: Record<string, number> = { en_cours: 0, a_faire: 1, termine: 2, archive: 3 };
    return enrichis.sort((a, b) =>
      (ordre[a.projet.statut] ?? 4) - (ordre[b.projet.statut] ?? 4)
    );
  }, [], []);
}

// ─────────────────────────────────────────────────────────────────────────────
// useMaisonOverview — stats globales pour le widget overview
// ─────────────────────────────────────────────────────────────────────────────

export function useMaisonOverview() {
  return useLiveQuery(async () => {
    const [pieces, tachesActives, projetsActifs] = await Promise.all([
      db.pieces.filter(p => p.actif && !p.deletedAt).toArray(),
      db.taches.filter(t =>
        !t.archive && !t.deletedAt &&
        t.moduleOrigine === 'maison' &&
        t.statut === 'a_faire'
      ).toArray(),
      db.projetsMaison.filter(p =>
        !p.archive && !p.deletedAt && p.statut !== 'termine'
      ).toArray(),
    ]);

    const scoreMoyen = pieces.length
      ? Math.round(pieces.reduce((acc, p) => acc + p.scoreProprety, 0) / pieces.length)
      : 0;

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const tachesEnRetard = tachesActives.filter(
      t => t.dateEcheance && new Date(t.dateEcheance) <= today
    ).length;

    const piecesCritiques = pieces.filter(
      p => (p.etatGeneral ?? scoreToEtat(p.scoreProprety)) === 'urgent'
    ).length;

    return {
      scoreMoyen,
      nbPieces: pieces.length,
      piecesCritiques,
      tachesEnAttente: tachesActives.length,
      tachesEnRetard,
      projetsEnCours: projetsActifs.filter(p => p.statut === 'en_cours').length,
    };
  }, [], null);
}
