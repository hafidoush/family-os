/**
 * FAMILY OS — formatDate helpers
 * Fonctions pures de formatage de dates.
 * Acceptent string | Date car Dexie renvoie les dates sous forme de strings
 * au runtime même si le type TypeScript déclare Date.
 */

type DateLike = Date | string

function toDate(d: DateLike): Date {
  if (d instanceof Date) return d
  // "YYYY-MM-DD" → interprète en heure locale pour éviter le décalage UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + 'T00:00:00')
  return new Date(d)
}

/** "lundi 3 juin 2026" */
export function formatDateLong(date: DateLike): string {
  return toDate(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "03/06/2026" */
export function formatDateShort(date: DateLike): string {
  return toDate(date).toLocaleDateString('fr-FR')
}

/** "YYYY-MM-DD" — format stocké en base (heure locale, pas UTC) */
export function toISODate(date: DateLike): string {
  const d = toDate(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "HH:mm" */
export function formatTime(date: DateLike): string {
  return toDate(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Vérifie si une date ISO "YYYY-MM-DD" correspond à aujourd'hui */
export function isToday(isoDate: string): boolean {
  return isoDate === toISODate(new Date())
}

/** Nombre de jours entre deux dates (positif si date2 > date1) */
export function daysBetween(date1: DateLike, date2: DateLike): number {
  const ms = toDate(date2).getTime() - toDate(date1).getTime()
  return Math.floor(ms / 86_400_000)
}
