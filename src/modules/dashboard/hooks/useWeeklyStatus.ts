/**
 * FAMILY OS — useWeeklyStatus
 *
 * Calcule l'état de complétion des 4 étapes de l'orchestrateur "Organiser ma semaine".
 * Entièrement hors ligne (Dexie). Re-calcule en temps réel via useLiveQuery.
 *
 * Étapes :
 *   1. Menus     — menu actif cette semaine avec au moins 3 slots remplis
 *   2. Courses   — liste de courses non vide OU cochée à >50% dans les 3 derniers jours
 *   3. Activités — au moins 1 activité planifiée cette semaine
 *   4. Ménage    — aucune tâche ménagère très en retard (>2× sa fréquence)
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../../core/db/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EtapeId = 'menus' | 'courses' | 'activites' | 'menage'

export interface EtapeSemaine {
  id: EtapeId
  label: string
  emoji: string
  done: boolean
  route: string
  detail?: string  // ex: "3 menus planifiés", "Aucune activité"
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function toISO(d: Date): string { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }

function getLundiSemaine(): Date {
  const d = today()
  const jour = d.getDay() // 0=dim, 6=sam
  // Samedi ou dimanche → viser le lundi de la semaine SUIVANTE
  if (jour === 0) return addDays(d, 1)       // dim → lundi +1
  if (jour === 6) return addDays(d, 2)       // sam → lundi +2
  // Sinon → lundi de la semaine en cours
  return addDays(d, 1 - jour)
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useWeeklyStatus(): {
  etapes: EtapeSemaine[]
  nbDone: number
  premierePendante: EtapeId | null
} {
  const lundi    = getLundiSemaine()
  const dimanche = addDays(lundi, 6)
  const lundiISO    = toISO(lundi)
  const dimancheISO = toISO(dimanche)
  const todayISO    = toISO(today())

  // ── 1. Menus ─────────────────────────────────────────────────────────────
  const nbMenuSlots = useLiveQuery(async () => {
    // Cherche le menu de la semaine en cours
    const menus = await db.menus
      .filter(m => !m.deletedAt && !m.archive &&
        m.dateDebut >= lundiISO && m.dateDebut <= dimancheISO)
      .toArray()

    if (menus.length === 0) {
      // Fallback : menu actif dont la plage couvre cette semaine
      const actifs = await db.menus
        .filter(m => !m.deletedAt && !m.archive &&
          m.dateDebut <= todayISO && (m.dateFin ?? '9999') >= todayISO)
        .toArray()
      if (actifs.length === 0) return 0
    }

    // Compte les slots avec une recette ou description
    const allMenuIds = (await db.menus
      .filter(m => !m.deletedAt && !m.archive &&
        ((m.dateDebut >= lundiISO && m.dateDebut <= dimancheISO) ||
         (m.dateDebut <= todayISO && (m.dateFin ?? '9999') >= todayISO)))
      .toArray()).map(m => m.id)

    if (allMenuIds.length === 0) return 0

    return db.menuSlots
      .filter(s => !s.deletedAt && allMenuIds.includes(s.menu) &&
        (!!s.recette || !!s.descriptionLibre))
      .count()
  }, [lundiISO, todayISO]) ?? -1

  // ── 2. Courses ───────────────────────────────────────────────────────────
  const coursesStats = useLiveQuery(async () => {
    const all = await db.coursesItems
      .filter(c => !c.deletedAt)
      .toArray()
    const nonCoches = all.filter(c => !c.coche)
    const coches    = all.filter(c => c.coche)
    return { total: all.length, nonCoches: nonCoches.length, coches: coches.length }
  }, []) ?? { total: 0, nonCoches: 0, coches: 0 }

  // ── 3. Activités ─────────────────────────────────────────────────────────
  const nbActivitesSemaine = useLiveQuery(async () => {
    return db.planificationsActivites
      .filter(p => !p.deletedAt && !p.archive &&
        p.datePrevue >= lundiISO && p.datePrevue <= dimancheISO)
      .count()
  }, [lundiISO]) ?? -1

  // ── 4. Ménage ─────────────────────────────────────────────────────────────
  const nbTachesUrgentes = useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.deletedAt && !t.archive &&
        t.moduleOrigine === 'maison' && t.statut === 'a_faire' && !!t.dateEcheance)
      .toArray()
    // Très en retard = échéance dépassée de plus de 7 jours
    const cutoff = addDays(today(), -7)
    return all.filter(t => new Date(t.dateEcheance!) < cutoff).length
  }, [todayISO]) ?? 0

  // ── Calcul des étapes ─────────────────────────────────────────────────────

  return useMemo(() => {
    const menusDone    = nbMenuSlots >= 3
    const coursesDone  = coursesStats.total > 0  // liste créée (vide ou avec items)
    const activitesDone = nbActivitesSemaine > 0
    const menageDone   = nbTachesUrgentes === 0

    const etapes: EtapeSemaine[] = [
      {
        id: 'menus',
        label: 'Menus',
        emoji: '🍽',
        done: menusDone,
        route: '/cuisine',
        detail: nbMenuSlots >= 0
          ? nbMenuSlots === 0
            ? 'Aucun repas planifié'
            : `${nbMenuSlots} repas planifié${nbMenuSlots > 1 ? 's' : ''}`
          : undefined,
      },
      {
        id: 'courses',
        label: 'Courses',
        emoji: '🛒',
        done: coursesDone,
        route: '/courses',
        detail: coursesStats.total === 0
          ? 'Liste vide'
          : coursesStats.nonCoches > 0
            ? `${coursesStats.nonCoches} article${coursesStats.nonCoches > 1 ? 's' : ''} à prendre`
            : 'Liste complète',
      },
      {
        id: 'activites',
        label: 'Activités',
        emoji: '🧒',
        done: activitesDone,
        route: '/enfants',
        detail: nbActivitesSemaine > 0
          ? `${nbActivitesSemaine} activité${nbActivitesSemaine > 1 ? 's' : ''} prévue${nbActivitesSemaine > 1 ? 's' : ''}`
          : 'Rien de prévu',
      },
      {
        id: 'menage',
        label: 'Ménage',
        emoji: '🫧',
        done: menageDone,
        route: '/menage',
        detail: nbTachesUrgentes > 0
          ? `${nbTachesUrgentes} tâche${nbTachesUrgentes > 1 ? 's' : ''} urgente${nbTachesUrgentes > 1 ? 's' : ''}`
          : 'Tout est à jour',
      },
    ]

    const nbDone = etapes.filter(e => e.done).length
    const premierePendante = etapes.find(e => !e.done)?.id ?? null

    return { etapes, nbDone, premierePendante }
  }, [nbMenuSlots, coursesStats, nbActivitesSemaine, nbTachesUrgentes])
}
