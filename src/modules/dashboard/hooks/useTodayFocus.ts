/**
 * FAMILY OS — useTodayFocus
 *
 * Calcule les 3 actions les plus importantes pour aujourd'hui.
 * Différent des suggestions (chips de navigation) : ici on expose
 * des actions concrètes avec un niveau de priorité explicite.
 *
 * Niveaux : 'urgent' | 'important' | 'utile'
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../../core/db/database'
import { useHabitudes } from '../../../shared/hooks/useHabitudes'
import { useHabituesRetard } from '../../../shared/hooks/useHabituesRetard'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionNiveau = 'urgent' | 'important' | 'utile'

export interface ActionJour {
  id: string
  niveau: ActionNiveau
  texte: string          // ex: "Faire les courses"
  contexte?: string      // ex: "14 articles prêts"
  route: string
  routeState?: Record<string, string>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function toISO(d: Date): string { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }

function parseHeure(hhmm: string | undefined, defaut: number): number {
  if (!hhmm) return defaut
  const [h, m] = hhmm.split(':').map(Number)
  return h + (m ?? 0) / 60
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useTodayFocus(): ActionJour[] {
  const habitudes = useHabitudes()
  const retard    = useHabituesRetard()

  const now           = new Date()
  const heureDecimale = now.getHours() + now.getMinutes() / 60
  const jour          = now.getDay()
  const demain        = ((jour + 1) % 7) as 0|1|2|3|4|5|6
  const todayISO      = toISO(today())

  // Fenêtres dynamiques
  const heureReveil  = parseHeure(habitudes.heureReveil, 7)
  const heureCoucher = parseHeure(habitudes.heureCoucher, 21)
  const estMatin     = heureDecimale >= heureReveil && heureDecimale < heureReveil + 2
  const estSoir      = heureDecimale >= heureCoucher - 1.5

  // Lundi de la semaine en cours
  const jourNum = today().getDay()
  const diffLundi = jourNum === 0 ? -6 : 1 - jourNum
  const lundi    = addDays(today(), diffLundi)
  const lundiISO = toISO(lundi)
  const dimancheISO = toISO(addDays(lundi, 6))

  // Lundi semaine prochaine
  const diffLundiProchain = (8 - jourNum) % 7 || 7
  const lundiProchainISO  = toISO(addDays(today(), diffLundiProchain))
  const dimancheProchainISO = toISO(addDays(today(), diffLundiProchain + 6))

  // ── Requêtes Dexie ──────────────────────────────────────────────────────────

  const nbCourses = useLiveQuery(
    () => db.coursesItems.filter(c => !c.deletedAt && !c.coche).count(), []
  ) ?? 0

  const nbTachesRetard = useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.deletedAt && !t.archive && t.statut === 'a_faire' && !!t.dateEcheance)
      .toArray()
    return all.filter(t => new Date(t.dateEcheance!) < today()).length
  }, [todayISO]) ?? 0

  const menusJoursRestants = useLiveQuery(async () => {
    const menus = await db.menus
      .filter(m => !m.deletedAt && !m.archive && !!m.dateFin)
      .toArray()
    const actif = menus.find(m => m.dateDebut <= todayISO && (m.dateFin ?? '9999') >= todayISO)
    if (!actif?.dateFin) return null
    return Math.max(0, Math.ceil((new Date(actif.dateFin).getTime() - today().getTime()) / 86400000))
  }, [todayISO]) ?? null

  const nbPensees = useLiveQuery(
    () => db.pensees.filter(p => !p.deletedAt && !p.archive && p.statut === 'active').count(), []
  ) ?? 0

  const nbActivitesCetteSemaine = useLiveQuery(async () => {
    return db.planificationsActivites
      .filter(p => !p.deletedAt && !p.archive &&
        p.datePrevue >= lundiISO && p.datePrevue <= dimancheISO)
      .count()
  }, [lundiISO]) ?? -1

  const menusSemanineProchaine = useLiveQuery(async () => {
    return db.menus
      .filter(m => !m.deletedAt && !m.archive &&
        m.dateDebut >= lundiProchainISO && m.dateDebut <= dimancheProchainISO)
      .count()
  }, [lundiProchainISO]) ?? -1

  // ── Calcul des 3 actions ──────────────────────────────────────────────────

  return useMemo(() => {
    const candidats: Array<{ prio: number; action: ActionJour }> = []
    const push = (prio: number, action: ActionJour) => candidats.push({ prio, action })

    // ── URGENT ────────────────────────────────────────────────────────────

    // Menus expirent aujourd'hui
    if (menusJoursRestants === 0) {
      push(100, {
        id: 'menus-expire',
        niveau: 'urgent',
        texte: 'Planifier les menus de la semaine prochaine',
        contexte: 'Expirent aujourd\'hui',
        route: '/cuisine',
      })
    }

    // Jour de courses + liste prête
    if (habitudes.jourCourses === jour && nbCourses > 0 && heureDecimale >= 9) {
      push(98, {
        id: 'courses-jouj',
        niveau: 'urgent',
        texte: 'Faire les courses',
        contexte: `${nbCourses} article${nbCourses > 1 ? 's' : ''} dans la liste`,
        route: '/courses',
        routeState: { tab: 'liste' },
      })
    }

    // Linge très en retard
    if (retard.linge?.tresEnRetard) {
      push(95, {
        id: 'linge-urgent',
        niveau: 'urgent',
        texte: 'Lancer une machine',
        contexte: `${retard.linge.retardJours}j de retard`,
        route: '/menage',
      })
    }

    // Aspirateur très en retard
    if (retard.aspirateur?.tresEnRetard) {
      push(90, {
        id: 'aspirateur-urgent',
        niveau: 'urgent',
        texte: 'Passer l\'aspirateur',
        contexte: `${retard.aspirateur.retardJours}j de retard`,
        route: '/menage',
      })
    }

    // Tâches en retard
    if (nbTachesRetard >= 2) {
      push(88, {
        id: 'taches-retard',
        niveau: 'urgent',
        texte: `Traiter ${nbTachesRetard} tâche${nbTachesRetard > 1 ? 's' : ''} en retard`,
        contexte: 'Depuis plusieurs jours',
        route: '/menage',
      })
    }

    // Batch cooking aujourd'hui
    if (habitudes.jourBatchCooking === jour) {
      push(85, {
        id: 'batch-jouj',
        niveau: 'urgent',
        texte: 'Lancer la session batch cooking',
        contexte: 'Prévu aujourd\'hui',
        route: '/cuisine',
      })
    }

    // ── IMPORTANT ─────────────────────────────────────────────────────────

    // Menus expirent demain ou dans 2j
    if (menusJoursRestants === 1 || menusJoursRestants === 2) {
      push(80, {
        id: 'menus-bientot',
        niveau: 'important',
        texte: 'Planifier les menus',
        contexte: menusJoursRestants === 1 ? 'Expirent demain' : 'Expirent dans 2j',
        route: '/cuisine',
      })
    }

    // Courses demain + liste vide
    if (habitudes.jourCourses === demain && nbCourses === 0) {
      push(78, {
        id: 'courses-demain-vide',
        niveau: 'important',
        texte: 'Préparer la liste de courses',
        contexte: 'Courses demain — liste vide',
        route: '/courses',
        routeState: { tab: 'liste' },
      })
    }

    // Veille courses + menus semaine prochaine absents
    if (habitudes.jourCourses === demain && menusSemanineProchaine === 0) {
      push(82, {
        id: 'courses-demain-sans-menus',
        niveau: 'important',
        texte: 'Planifier les menus avant les courses',
        contexte: 'Courses demain — menus manquants',
        route: '/cuisine',
      })
    }

    // Linge en retard (simple)
    if (retard.linge?.enRetard && !retard.linge.tresEnRetard) {
      push(72, {
        id: 'linge-retard',
        niveau: 'important',
        texte: 'Lancer le linge',
        contexte: `${retard.linge.retardJours}j de retard`,
        route: '/menage',
      })
    }

    // Aucune activité enfants cette semaine (milieu ou fin de semaine)
    if (nbActivitesCetteSemaine === 0 && (jour >= 1 && jour <= 5)) {
      push(68, {
        id: 'activites-semaine',
        niveau: 'important',
        texte: 'Planifier des activités pour les enfants',
        contexte: 'Rien de prévu cette semaine',
        route: '/enfants',
      })
    }

    // ── UTILE ─────────────────────────────────────────────────────────────

    // Pensées à traiter
    if (nbPensees >= 3) {
      push(60, {
        id: 'pensees',
        niveau: 'utile',
        texte: 'Traiter tes pensées en attente',
        contexte: `${nbPensees} idées à organiser`,
        route: '/pensees',
      })
    }

    // Matin → voir le planning
    if (estMatin) {
      push(55, {
        id: 'planning-matin',
        niveau: 'utile',
        texte: 'Voir le planning du jour',
        contexte: 'Bonne journée',
        route: '/programme-du-jour',
      })
    }

    // Soir → préparer demain
    if (estSoir) {
      push(55, {
        id: 'preparer-demain',
        niveau: 'utile',
        texte: 'Préparer demain',
        contexte: 'Fin de journée',
        route: '/programme-du-jour',
      })
    }

    // Dimanche → organiser la semaine
    if (jour === 0) {
      push(50, {
        id: 'organiser-semaine-dim',
        niveau: 'utile',
        texte: 'Organiser la semaine qui arrive',
        contexte: 'Menus, activités, ménage',
        route: '/cuisine',
      })
    }

    // Fallback
    push(10, {
      id: 'fallback-menus',
      niveau: 'utile',
      texte: 'Voir les idées repas de la semaine',
      contexte: undefined,
      route: '/cuisine',
    })

    // Top 3 par priorité, dédoublonnés
    const seen = new Set<string>()
    return candidats
      .sort((a, b) => b.prio - a.prio)
      .filter(({ action }) => {
        if (seen.has(action.id)) return false
        seen.add(action.id)
        return true
      })
      .slice(0, 3)
      .map(({ action }) => action)
  }, [
    nbCourses, nbTachesRetard, menusJoursRestants, nbPensees,
    nbActivitesCetteSemaine, menusSemanineProchaine,
    habitudes, retard, jour, demain, heureDecimale, estMatin, estSoir,
  ])
}
