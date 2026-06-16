/**
 * FAMILY OS — Hooks Calendrier Famille
 * Requêtes Dexie réactives pour les événements partagés
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@core/db/database';
import { toISODate } from '@shared/utils/formatDate';

// ─── Tous les événements non archivés ─────────────────────────────────────────

export function useEvenements() {
  return useLiveQuery(
    () => db.evenements
      .filter(e => !e.archive && !e.deletedAt)
      .toArray()
      .then(list => list.sort((a, b) =>
        new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime()
      )),
    []
  );
}

// ─── Événements d'une semaine (lun–dim) ───────────────────────────────────────

export function useEvenementsSemaine(lundiDate: Date) {
  const lundi = new Date(lundiDate);
  lundi.setHours(0, 0, 0, 0);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  dimanche.setHours(23, 59, 59, 999);

  return useLiveQuery(
    () => db.evenements
      .filter(e => {
        if (e.archive || e.deletedAt) return false;
        const d = new Date(e.dateDebut);
        return d >= lundi && d <= dimanche;
      })
      .toArray()
      .then(list => list.sort((a, b) =>
        new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime()
      )),
    [lundi.toISOString()]
  );
}

// ─── Événements d'un mois ─────────────────────────────────────────────────────

export function useEvenementsMois(annee: number, mois: number) {
  const debut = new Date(annee, mois, 1);
  const fin = new Date(annee, mois + 1, 0, 23, 59, 59);

  return useLiveQuery(
    () => db.evenements
      .filter(e => {
        if (e.archive || e.deletedAt) return false;
        const d = new Date(e.dateDebut);
        return d >= debut && d <= fin;
      })
      .toArray()
      .then(list => list.sort((a, b) =>
        new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime()
      )),
    [annee, mois]
  );
}

// ─── Événements d'un jour ─────────────────────────────────────────────────────

export function useEvenementsJour(dateISO: string) {
  return useLiveQuery(
    () => db.evenements
      .filter(e => !e.archive && !e.deletedAt && toISODate(new Date(e.dateDebut)) === dateISO)
      .toArray()
      .then(list => list.sort((a, b) =>
        new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime()
      )),
    [dateISO]
  );
}

// ─── Un événement par id ───────────────────────────────────────────────────────

export function useEvenement(id: string | null) {
  return useLiveQuery(
    () => id ? db.evenements.get(id) : undefined,
    [id]
  );
}

// ─── Prochains événements (N jours) ───────────────────────────────────────────

export function useProchainEvenements(nbJours = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fin = new Date(today);
  fin.setDate(today.getDate() + nbJours);

  return useLiveQuery(
    () => db.evenements
      .filter(e => {
        if (e.archive || e.deletedAt) return false;
        const d = new Date(e.dateDebut);
        return d >= today && d <= fin;
      })
      .toArray()
      .then(list => list.sort((a, b) =>
        new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime()
      )),
    []
  );
}

// ─── Membres pour résolution des IDs ─────────────────────────────────────────

export function useMembres() {
  return useLiveQuery(
    () => db.membres.filter(m => m.actif && !m.deletedAt).toArray(),
    []
  );
}
