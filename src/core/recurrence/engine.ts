/**
 * Moteur de récurrence Family OS
 * Calcule les instances d'un événement récurrent dans une plage de dates.
 */

import type { RegleRecurrence } from '../../shared/types/entities';

const MS_PER_DAY = 86_400_000;

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Nombre de jours entiers entre deux dates (arrondi) */
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

/** Lundi de la semaine ISO contenant `d` */
function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=dim
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(d), diff);
}

/** Semaines ISO entre deux dates */
function weeksBetween(a: Date, b: Date): number {
  return Math.round(daysBetween(mondayOf(a), mondayOf(b)) / 7);
}

/** Mois entiers entre deux dates */
function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** Position du jour dans son mois : 1er lundi, 2ème lundi… */
function positionInMonth(d: Date): number {
  return Math.ceil(d.getDate() / 7);
}

/** Vérifie si c'est la Nième occurrence d'un jour de la semaine dans le mois */
function isNthWeekdayOfMonth(d: Date, position: number, weekday: number): boolean {
  if (d.getDay() !== weekday) return false;
  if (position > 0) return positionInMonth(d) === position;
  // position === -1 : dernier du mois
  const nextWeek = addDays(d, 7);
  return nextWeek.getMonth() !== d.getMonth();
}

/**
 * Retourne true si `date` est une occurrence de la règle `regle`
 * (hors exceptions — à vérifier séparément).
 */
function isOccurrence(date: Date, regle: RegleRecurrence): boolean {
  const ref = new Date(regle.dateDebutRecurrence);
  const d = startOfDay(date);
  const r = startOfDay(ref);

  if (d < r) return false;

  switch (regle.frequence) {
    case 'quotidienne': {
      const diff = daysBetween(r, d);
      return diff % (regle.intervalle || 1) === 0;
    }

    case 'hebdomadaire': {
      const weeks = weeksBetween(r, d);
      if (weeks % (regle.intervalle || 1) !== 0) return false;
      const jours = regle.joursHebdo?.length ? regle.joursHebdo : [r.getDay()];
      return jours.includes(d.getDay());
    }

    case 'mensuelle': {
      const months = monthsBetween(r, d);
      if (months < 0 || months % (regle.intervalle || 1) !== 0) return false;
      if (regle.typeMensuel === 'positionSemaine' &&
          regle.positionSemaine != null &&
          regle.jourDeSemaine != null) {
        return isNthWeekdayOfMonth(d, regle.positionSemaine, regle.jourDeSemaine);
      }
      // jourFixe (défaut : même jour que dateDebutRecurrence)
      const jourCible = regle.jourFixe ?? r.getDate();
      return d.getDate() === jourCible;
    }

    case 'annuelle': {
      const years = d.getFullYear() - r.getFullYear();
      if (years < 0 || years % (regle.intervalle || 1) !== 0) return false;
      return d.getMonth() === r.getMonth() && d.getDate() === r.getDate();
    }
  }
}

/** Retourne les ISO dates d'occurrence dans [rangeStart, rangeEnd] */
export function getOccurrencesInRange(
  regle: RegleRecurrence,
  rangeStart: Date,
  rangeEnd: Date
): string[] {
  const exceptions = new Set(regle.exceptions ?? []);
  const hardEnd = regle.dateFinRecurrence
    ? new Date(regle.dateFinRecurrence)
    : null;

  const start = startOfDay(new Date(Math.max(
    new Date(regle.dateDebutRecurrence).getTime(),
    rangeStart.getTime()
  )));
  const end = startOfDay(hardEnd
    ? new Date(Math.min(hardEnd.getTime(), rangeEnd.getTime()))
    : rangeEnd
  );

  const results: string[] = [];
  let count = 0;
  let cur = start;

  while (cur <= end) {
    const iso = toISO(cur);
    if (isOccurrence(cur, regle) && !exceptions.has(iso)) {
      results.push(iso);
      count++;
      if (regle.maxOccurrences && count >= regle.maxOccurrences) break;
    }
    cur = addDays(cur, 1);
  }

  return results;
}

/**
 * Retourne true si l'événement a une occurrence à la date ISO donnée.
 */
export function hasOccurrenceOn(regle: RegleRecurrence, isoDate: string): boolean {
  const d = new Date(isoDate);
  const exceptions = new Set(regle.exceptions ?? []);
  if (exceptions.has(isoDate)) return false;
  if (regle.dateFinRecurrence && isoDate > regle.dateFinRecurrence) return false;
  if (isoDate < regle.dateDebutRecurrence) return false;
  return isOccurrence(d, regle);
}
