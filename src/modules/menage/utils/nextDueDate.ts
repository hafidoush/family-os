/**
 * nextDueDate — calcule la prochaine échéance d'une tâche récurrente.
 *
 * Logique :
 *  - Si la tâche a été complétée (completeeLe défini) :
 *      prochaine = completeeLe + 1 intervalle
 *  - Sinon, avance depuis dateReference (ou createdAt) par intervalles
 *    jusqu'à trouver la première date >= aujourd'hui.
 *
 * Renvoie null pour les tâches ponctuelles ou sans fréquence.
 */

import type { Tache, FrequenceTache } from '@shared/types/entities';

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addInterval(date: Date, frequence: FrequenceTache): Date {
  const d = new Date(date);
  switch (frequence) {
    case 'quotidienne':    d.setDate(d.getDate() + 1);          break;
    case 'hebdomadaire':   d.setDate(d.getDate() + 7);          break;
    case 'bihebdomadaire': d.setDate(d.getDate() + 14);         break;
    case 'mensuelle':      d.setMonth(d.getMonth() + 1);        break;
    case 'trimestrielle':  d.setMonth(d.getMonth() + 3);        break;
    case 'semestrielle':   d.setMonth(d.getMonth() + 6);        break;
    case 'annuelle':       d.setFullYear(d.getFullYear() + 1);  break;
  }
  return d;
}

export function nextDueDate(tache: Tache): Date | null {
  if (!tache.recurrence || !tache.frequence || tache.frequence === 'ponctuelle') {
    return tache.dateEcheance ? new Date(tache.dateEcheance) : null;
  }

  const today = startOfDay(new Date());

  // Cas 1 : tâche déjà complétée — prochaine = completeeLe + 1 intervalle
  if (tache.completeeLe) {
    const base = startOfDay(new Date(tache.completeeLe));
    return addInterval(base, tache.frequence);
  }

  // Cas 2 : jamais complétée — avance depuis dateReference (ou createdAt)
  const anchor = tache.dateReference
    ? startOfDay(new Date(tache.dateReference))
    : startOfDay(new Date(tache.createdAt));

  let next = new Date(anchor);
  // Avance jusqu'à la première occurrence >= aujourd'hui
  while (next < today) {
    next = addInterval(next, tache.frequence);
  }
  return next;
}

/** Renvoie true si la tâche est due aujourd'hui. */
export function isDueToday(tache: Tache): boolean {
  const due = nextDueDate(tache);
  if (!due) return false;
  const today = startOfDay(new Date());
  return due.getTime() === today.getTime();
}

/** Renvoie true si la tâche est en retard (échéance dépassée, non faite). */
export function isOverdue(tache: Tache): boolean {
  if (tache.statut === 'fait') return false;
  const due = nextDueDate(tache);
  if (!due) return false;
  const today = startOfDay(new Date());
  return due < today;
}

/** Renvoie true si la tâche est due cette semaine (après aujourd'hui). */
export function isDueThisWeek(tache: Tache): boolean {
  const due = nextDueDate(tache);
  if (!due) return false;
  const today = startOfDay(new Date());
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return due > today && due <= endOfWeek;
}
