/**
 * FAMILY OS — useWeeklyBilan
 *
 * Calcule le bilan de la semaine en cours et l'état de préparation
 * de la semaine suivante. Utilisé par WidgetBilanSemaine.
 *
 * Données remontées :
 *  - Semaine en cours  : activités réalisées, menus couverts, tâches ménage
 *  - Semaine suivante  : menus planifiés, courses, activités, linge/aspirateur
 *  - Score global      : 0-100
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../../core/db/database'
import { useHabitudes } from '../../../shared/hooks/useHabitudes'
import { useHabituesRetard } from '../../../shared/hooks/useHabituesRetard'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function toISO(d: Date): string { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }

function getLundi(base: Date): Date {
  const d = new Date(base); d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PointBilan {
  label: string
  valeur: string
  ok: boolean
  urgent?: boolean
}

export interface WeeklyBilan {
  // Semaine en cours
  semaineCourante: {
    activitesRealisees: number
    activitesTotal: number
    menusCouvertsJours: number   // jours avec au moins un repas
    tachesUrgentes: number
    penseesPendantes: number
  }
  // Semaine prochaine
  semaineSuivante: {
    menusPlannifies: boolean
    coursesPresentes: boolean
    activitesPlannifies: number
    lingEnRetard: boolean
    aspirateurEnRetard: boolean
  }
  // Points résumé pour affichage
  points: PointBilan[]
  // Score 0-100
  score: number
  // true si tout est prêt pour la semaine prochaine
  pret: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWeeklyBilan(): WeeklyBilan | null {
  const habitudes = useHabitudes()
  const retard    = useHabituesRetard()

  const lundi        = getLundi(today())
  const dimanche     = addDays(lundi, 6)
  const lundiISO     = toISO(lundi)
  const dimancheISO  = toISO(dimanche)

  const lundiProchain    = addDays(lundi, 7)
  const dimancheProchain = addDays(lundiProchain, 6)
  const lundiProchainISO    = toISO(lundiProchain)
  const dimancheProchainISO = toISO(dimancheProchain)

  // ── Semaine en cours ────────────────────────────────────────────────────────

  const activitesSemaine = useLiveQuery(async () => {
    return db.planificationsActivites
      .filter(p => !p.deletedAt && !p.archive &&
        p.datePrevue >= lundiISO && p.datePrevue <= dimancheISO)
      .toArray()
  }, [lundiISO]) ?? []

  const menuSlotsSemaine = useLiveQuery(async () => {
    const menus = await db.menus
      .filter(m => !m.deletedAt && !m.archive &&
        ((m.dateDebut >= lundiISO && m.dateDebut <= dimancheISO) ||
         (m.dateDebut <= lundiISO && (m.dateFin ?? '9999') >= lundiISO)))
      .toArray()
    if (!menus.length) return []
    const menuIds = new Set(menus.map(m => m.id))
    return db.menuSlots
      .filter(s => !s.deletedAt && menuIds.has(s.menu) && (!!s.recette || !!s.descriptionLibre))
      .toArray()
  }, [lundiISO]) ?? []

  const tachesUrgentes = useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.deletedAt && !t.archive &&
        t.moduleOrigine === 'maison' && t.statut === 'a_faire' && !!t.dateEcheance)
      .toArray()
    const cutoff = addDays(today(), -7)
    return all.filter(t => new Date(t.dateEcheance!) < cutoff).length
  }, []) ?? 0

  const penseesPendantes = useLiveQuery(
    () => db.pensees.filter(p => !p.deletedAt && !p.archive && p.statut === 'active').count(), []
  ) ?? 0

  // ── Semaine prochaine ────────────────────────────────────────────────────────

  const menusProchaineSemaine = useLiveQuery(async () => {
    return db.menus
      .filter(m => !m.deletedAt && !m.archive &&
        m.dateDebut >= lundiProchainISO && m.dateDebut <= dimancheProchainISO)
      .count()
  }, [lundiProchainISO]) ?? 0

  const nbCoursesRestantes = useLiveQuery(
    () => db.coursesItems.filter(c => !c.deletedAt && !c.coche).count(), []
  ) ?? 0

  const activitesProchaineSemaine = useLiveQuery(async () => {
    return db.planificationsActivites
      .filter(p => !p.deletedAt && !p.archive &&
        p.datePrevue >= lundiProchainISO && p.datePrevue <= dimancheProchainISO)
      .count()
  }, [lundiProchainISO]) ?? 0

  // ── Calcul bilan ────────────────────────────────────────────────────────────

  return useMemo(() => {
    const activitesRealisees = activitesSemaine.filter(a => a.statut === 'realisee').length
    const activitesTotal     = activitesSemaine.length

    // Jours uniques avec au moins un slot de menu
    const joursAvecMenu = new Set(menuSlotsSemaine.map(s => s.jour)).size
    const menusCouvertsJours = joursAvecMenu

    const lingEnRetard       = retard.linge?.enRetard ?? false
    const aspirateurEnRetard = retard.aspirateur?.enRetard ?? false

    const semaineSuivante = {
      menusPlannifies:      menusProchaineSemaine > 0,
      coursesPresentes:     nbCoursesRestantes > 0,
      activitesPlannifies:  activitesProchaineSemaine,
      lingEnRetard,
      aspirateurEnRetard,
    }

    // Points résumé
    const points: PointBilan[] = []

    // Menus semaine prochaine
    points.push({
      label:  'Menus semaine prochaine',
      valeur: semaineSuivante.menusPlannifies ? 'Planifiés' : 'Non planifiés',
      ok:     semaineSuivante.menusPlannifies,
      urgent: !semaineSuivante.menusPlannifies,
    })

    // Courses
    points.push({
      label:  'Liste de courses',
      valeur: semaineSuivante.coursesPresentes
        ? `${nbCoursesRestantes} article${nbCoursesRestantes > 1 ? 's' : ''} à prendre`
        : 'Liste vide',
      ok:     semaineSuivante.coursesPresentes,
    })

    // Activités semaine prochaine
    points.push({
      label:  'Activités enfants',
      valeur: semaineSuivante.activitesPlannifies > 0
        ? `${semaineSuivante.activitesPlannifies} prévue${semaineSuivante.activitesPlannifies > 1 ? 's' : ''}`
        : 'Aucune prévue',
      ok:     semaineSuivante.activitesPlannifies > 0,
    })

    // Ménage
    if (lingEnRetard || aspirateurEnRetard) {
      const retards = [
        lingEnRetard       ? 'linge' : '',
        aspirateurEnRetard ? 'aspirateur' : '',
      ].filter(Boolean).join(' + ')
      points.push({
        label:  'Ménage',
        valeur: `Retard : ${retards}`,
        ok:     false,
        urgent: retard.linge?.tresEnRetard || retard.aspirateur?.tresEnRetard,
      })
    } else {
      points.push({
        label:  'Ménage',
        valeur: 'À jour',
        ok:     true,
      })
    }

    // Tâches urgentes
    if (tachesUrgentes > 0) {
      points.push({
        label:  'Tâches en retard',
        valeur: `${tachesUrgentes} tâche${tachesUrgentes > 1 ? 's' : ''}`,
        ok:     false,
        urgent: true,
      })
    }

    // Pensées pendantes
    if (penseesPendantes >= 3) {
      points.push({
        label:  'Pensées en attente',
        valeur: `${penseesPendantes} idées à traiter`,
        ok:     false,
      })
    }

    // Score : nombre de points OK / total
    const nbOk    = points.filter(p => p.ok).length
    const score   = Math.round((nbOk / Math.max(points.length, 1)) * 100)
    const pret    = points.every(p => p.ok)

    return {
      semaineCourante: {
        activitesRealisees,
        activitesTotal,
        menusCouvertsJours,
        tachesUrgentes,
        penseesPendantes,
      },
      semaineSuivante,
      points,
      score,
      pret,
    }
  }, [
    activitesSemaine, menuSlotsSemaine, tachesUrgentes, penseesPendantes,
    menusProchaineSemaine, nbCoursesRestantes, activitesProchaineSemaine,
    retard,
  ])
}
