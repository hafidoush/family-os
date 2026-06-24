/**
 * FAMILY OS — useNotifications
 *
 * Produit la notification la plus prioritaire à afficher sur le dashboard.
 * - Entièrement hors ligne (Dexie + localStorage)
 * - Une seule notification visible à la fois (la plus urgente)
 * - Dismissal persisté 24h dans localStorage
 * - Différent des suggestions : c'est une alerte proactive, pas un raccourci
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useCallback } from 'react'
import { db } from '../../../core/db/database'
import { useHabitudes } from '../../../shared/hooks/useHabitudes'
import { useHabituesRetard } from '../../../shared/hooks/useHabituesRetard'
import { isDueToday, isOverdue } from '../../menage/utils/nextDueDate'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotifVariant = 'info' | 'warning' | 'urgent'

export interface AppNotification {
  id: string              // identifiant stable pour le dismiss
  variant: NotifVariant
  emoji: string
  message: string
  actionLabel: string
  actionRoute: string
  actionState?: Record<string, string>
}

// ─── Persistance dismiss (localStorage, TTL 24h) ─────────────────────────────

const LS_KEY = 'family_os_notif_dismissed'

function getDismissed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') }
  catch { return {} }
}

function isDismissed(id: string): boolean {
  const map = getDismissed()
  const ts  = map[id]
  if (!ts) return false
  return Date.now() - ts < 24 * 60 * 60 * 1000 // 24h
}

export function dismissNotification(id: string): void {
  const map = getDismissed()
  map[id]   = Date.now()
  // Nettoyer les entrées expirées
  const now = Date.now()
  for (const k of Object.keys(map)) {
    if (now - map[k] >= 24 * 60 * 60 * 1000) delete map[k]
  }
  localStorage.setItem(LS_KEY, JSON.stringify(map))
}

// ─── Helpers temporels ────────────────────────────────────────────────────────

function today(): Date { const d = new Date(); d.setHours(0,0,0,0); return d }
function toISO(d: Date): string { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useNotifications(): {
  notification: AppNotification | null
  dismiss: () => void
} {
  const habitudes  = useHabitudes()
  const retard     = useHabituesRetard()
  const now        = new Date()
  const jour       = now.getDay()
  const heure      = now.getHours()
  const minutes    = now.getMinutes()
  const heureDecimale = heure + minutes / 60   // ex: 8.5 = 8h30
  const todayISO   = toISO(today())
  const tomorrowISO = toISO(addDays(today(), 1))
  const hierISO    = toISO(addDays(today(), -1))

  const demain = ((jour + 1) % 7) as 0|1|2|3|4|5|6

  // Début semaine prochaine
  const diffLundi       = (8 - jour) % 7 || 7
  const lundiProchain   = addDays(today(), diffLundi)
  const dimancheProchain = addDays(lundiProchain, 6)

  // Fenêtres temporelles — basées sur les habitudes si configurées, sinon valeurs par défaut
  function parseHeure(hhmm: string | undefined, defaut: number): number {
    if (!hhmm) return defaut
    const [h, m] = hhmm.split(':').map(Number)
    return h + (m ?? 0) / 60
  }
  const heureReveil  = parseHeure(habitudes.heureReveil,  7)
  const heureCoucher = parseHeure(habitudes.heureCoucher, 21)
  const estMatin     = heureDecimale >= heureReveil && heureDecimale < heureReveil + 2
  const estSoir      = heureDecimale >= heureCoucher - 1.5

  // ── Requêtes Dexie ──────────────────────────────────────────────────────────

  const menusJoursRestants = useLiveQuery(async () => {
    const menus = await db.menus.filter(m => !m.deletedAt && !m.archive && !!m.dateFin).toArray()
    const actif = menus.find(m => m.dateDebut <= todayISO && (m.dateFin ?? '9999') >= todayISO)
    if (!actif?.dateFin) return null // pas de menu actif
    const fin  = new Date(actif.dateFin)
    return Math.max(0, Math.ceil((fin.getTime() - today().getTime()) / 86400000))
  }, [todayISO]) ?? null

  const nbCourses = useLiveQuery(
    () => db.coursesItems.filter(c => !c.deletedAt && !c.coche).count(), []
  ) ?? 0

  const nbTachesRetard = useLiveQuery(async () => {
    const all = await db.taches.filter(t =>
      !t.deletedAt && !t.archive && t.statut === 'a_faire' && !!t.dateEcheance
    ).toArray()
    return all.filter(t => new Date(t.dateEcheance!) < today()).length
  }, [todayISO]) ?? 0

  // M01 — Tâches ménage dues aujourd'hui (quotidiennes + périodiques à échéance)
  const nbTachesMenageDuJour = useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.deletedAt && !t.archive && t.moduleOrigine === 'maison')
      .toArray()
    const todayStart = today()
    const isdonToday = (t: import('@shared/types/entities').Tache) => {
      if (t.statut !== 'fait' || !t.completeeLe) return false
      const c = new Date(t.completeeLe); c.setHours(0,0,0,0)
      return c.getTime() === todayStart.getTime()
    }
    const quotidiennes = all.filter(t => t.frequence === 'quotidienne' && !isdonToday(t))
    const periodiques  = all.filter(t =>
      t.frequence && t.frequence !== 'quotidienne' && t.frequence !== 'ponctuelle'
      && !t.contexteLibre?.startsWith('saisonniere::')
      && (isDueToday(t) || isOverdue(t)) && !isdonToday(t)
    )
    return quotidiennes.length + periodiques.length
  }, [todayISO]) ?? 0

  const activitesSemaineProchaine = useLiveQuery(async () => {
    return db.planificationsActivites.filter(p =>
      !p.deletedAt && !p.archive &&
      p.datePrevue >= toISO(lundiProchain) &&
      p.datePrevue <= toISO(dimancheProchain)
    ).count()
  }, [toISO(lundiProchain)]) ?? -1

  // A4 — Menus pour la semaine prochaine existent-ils ?
  const menusSemanineProchaine = useLiveQuery(async () => {
    const lundiISO    = toISO(lundiProchain)
    const dimancheISO = toISO(dimancheProchain)
    return db.menus
      .filter(m => !m.deletedAt && !m.archive &&
        m.dateDebut >= lundiISO && m.dateDebut <= dimancheISO)
      .count()
  }, [toISO(lundiProchain)]) ?? -1

  // A5 — Routines matin actives (présence de routine, sans tracking de complétion)
  const aRoutineMatin = useLiveQuery(async () => {
    if (!habitudes.routineMatinActivee) return false
    return db.routines
      .filter(r => !r.deletedAt && !r.archive && r.actif && r.creneau === 'matin')
      .count()
      .then(n => n > 0)
  }, [habitudes.routineMatinActivee]) ?? false

  // ── Construction des candidats ─────────────────────────────────────────────

  const candidates = useMemo((): Array<{ prio: number; notif: AppNotification }> => {
    const list: Array<{ prio: number; notif: AppNotification }> = []
    const push = (prio: number, notif: AppNotification) => list.push({ prio, notif })

    // N01 — Menus expirent aujourd'hui
    if (menusJoursRestants === 0) {
      push(100, {
        id: `menus-expire-${todayISO}`,
        variant: 'urgent',
        emoji: '🍽',
        message: 'Vos menus se terminent aujourd\'hui. Planifiez ceux de la semaine prochaine.',
        actionLabel: 'Planifier les menus',
        actionRoute: '/cuisine',
      })
    }

    // N02 — Menus expirent demain
    if (menusJoursRestants === 1) {
      push(90, {
        id: `menus-expire-demain-${todayISO}`,
        variant: 'warning',
        emoji: '🍽',
        message: 'Vos menus se terminent demain. Souhaitez-vous préparer ceux de la semaine prochaine ?',
        actionLabel: 'Planifier maintenant',
        actionRoute: '/cuisine',
      })
    }

    // N03 — Menus expirent dans 2 jours
    if (menusJoursRestants === 2) {
      push(70, {
        id: `menus-expire-2j-${todayISO}`,
        variant: 'info',
        emoji: '🍽',
        message: 'Vos menus se terminent dans 2 jours. Bonne occasion de planifier la semaine prochaine.',
        actionLabel: 'Préparer les menus',
        actionRoute: '/cuisine',
      })
    }

    // N04 — Jour de courses aujourd'hui + liste vide
    if (habitudes.jourCourses === jour && nbCourses === 0) {
      push(95, {
        id: `courses-jour-vide-${todayISO}`,
        variant: 'urgent',
        emoji: '🛒',
        message: 'C\'est votre jour de courses et votre liste est vide. Générez-la depuis vos menus.',
        actionLabel: 'Créer la liste',
        actionRoute: '/courses',
        actionState: { tab: 'liste' },
      })
    }

    // N05 — Courses demain + liste vide (habitudes)
    if (habitudes.jourCourses === demain && nbCourses === 0) {
      push(80, {
        id: `courses-demain-vide-${todayISO}`,
        variant: 'warning',
        emoji: '🛒',
        message: 'Votre jour de courses est demain et votre liste est vide. Préparez-la ce soir.',
        actionLabel: 'Préparer la liste',
        actionRoute: '/courses',
        actionState: { tab: 'liste' },
      })
    }

    // N06 — Batch cooking demain (habitudes)
    if (habitudes.jourBatchCooking === demain) {
      push(75, {
        id: `batch-demain-${tomorrowISO}`,
        variant: 'info',
        emoji: '👩‍🍳',
        message: 'Votre session de batch cooking est prévue demain. Vérifiez que vos ingrédients sont prêts.',
        actionLabel: 'Voir les recettes',
        actionRoute: '/cuisine',
      })
    }

    // N07 — Tâches en retard
    if (nbTachesRetard >= 3) {
      push(85, {
        id: `taches-retard-${todayISO}`,
        variant: 'warning',
        emoji: '⚠️',
        message: `${nbTachesRetard} tâches sont en retard. Prenez quelques minutes pour les traiter.`,
        actionLabel: 'Voir les tâches',
        actionRoute: '/maison',
      })
    }

    // N08 — Activités enfants non planifiées (vendredi ou samedi → anticiper semaine d'après)
    if ((jour === 5 || jour === 6) && activitesSemaineProchaine === 0) {
      push(60, {
        id: `activites-semaine-${toISO(lundiProchain)}`,
        variant: 'info',
        emoji: '🧒',
        message: 'Vous n\'avez pas encore planifié d\'activités pour les enfants la semaine prochaine.',
        actionLabel: 'Planifier',
        actionRoute: '/enfants',
      })
    }

    // A1 — Courses jour J avec liste non vide (rappel d'y aller physiquement)
    if (habitudes.jourCourses === jour && nbCourses > 0 && heureDecimale >= 10) {
      push(91, {
        id: `courses-jour-rappel-${todayISO}`,
        variant: 'warning',
        emoji: '🛒',
        message: `C'est votre jour de courses. Votre liste est prête avec ${nbCourses} article${nbCourses > 1 ? 's' : ''}.`,
        actionLabel: 'Voir la liste',
        actionRoute: '/courses',
        actionState: { tab: 'liste' },
      })
    }

    // A3 — Batch cooking jour J
    if (habitudes.jourBatchCooking === jour) {
      push(78, {
        id: `batch-jouj-${todayISO}`,
        variant: 'info',
        emoji: '👩‍🍳',
        message: 'C\'est votre jour de batch cooking. Vos recettes vous attendent dans Cuisine.',
        actionLabel: 'Voir les recettes',
        actionRoute: '/cuisine',
      })
    }

    // A4 — Veille des courses + menus semaine prochaine manquants
    if (habitudes.jourCourses === demain && menusSemanineProchaine === 0) {
      push(87, {
        id: `courses-demain-sans-menus-${todayISO}`,
        variant: 'warning',
        emoji: '🍽',
        message: 'Vos courses sont demain mais les menus de la semaine prochaine ne sont pas encore planifiés.',
        actionLabel: 'Planifier les menus',
        actionRoute: '/cuisine',
      })
    }

    // A5 — Routine matin dans la fenêtre post-réveil
    if (estMatin && aRoutineMatin) {
      push(73, {
        id: `routine-matin-${todayISO}`,
        variant: 'info',
        emoji: '☀️',
        message: 'Bonne matinée. Ta routine du matin t\'attend.',
        actionLabel: 'Ma routine',
        actionRoute: '/routines',
      })
    }

    // A6 — Batch cooking demain + courses non faites hier ou aujourd'hui
    const coursesFaitesRecemment = nbCourses === 0  // liste vide = faites ou pas encore créées
    if (habitudes.jourBatchCooking === demain && !coursesFaitesRecemment) {
      push(84, {
        id: `batch-demain-courses-${todayISO}`,
        variant: 'warning',
        emoji: '🧺',
        message: 'Batch cooking demain : pensez à ajouter les ingrédients manquants à votre liste de courses.',
        actionLabel: 'Liste de courses',
        actionRoute: '/courses',
        actionState: { tab: 'liste' },
      })
    }

    // N09 — Linge très en retard (> 2× la fréquence)
    if (retard.linge?.tresEnRetard) {
      const j = retard.linge.retardJours!
      push(88, {
        id: `linge-tres-retard-${todayISO}`,
        variant: 'urgent',
        emoji: '🫧',
        message: `Le linge est en retard de ${j} jour${j > 1 ? 's' : ''}. C'est le bon moment pour lancer une machine.`,
        actionLabel: 'Ménage',
        actionRoute: '/menage',
      })
    } else if (retard.linge?.enRetard) {
      const j = retard.linge.retardJours!
      push(72, {
        id: `linge-retard-${todayISO}`,
        variant: 'warning',
        emoji: '🫧',
        message: `Le linge n'a pas été fait depuis ${retard.linge.joursDepuis} jour${(retard.linge.joursDepuis ?? 0) > 1 ? 's' : ''} (retard : ${j}j).`,
        actionLabel: 'Voir le ménage',
        actionRoute: '/menage',
      })
    }

    // N10 — Aspirateur très en retard
    if (retard.aspirateur?.tresEnRetard) {
      const j = retard.aspirateur.retardJours!
      push(82, {
        id: `aspirateur-tres-retard-${todayISO}`,
        variant: 'urgent',
        emoji: '🌀',
        message: `L'aspirateur est en retard de ${j} jour${j > 1 ? 's' : ''}. Un passage s'impose.`,
        actionLabel: 'Ménage',
        actionRoute: '/menage',
      })
    } else if (retard.aspirateur?.enRetard) {
      const j = retard.aspirateur.retardJours!
      push(65, {
        id: `aspirateur-retard-${todayISO}`,
        variant: 'info',
        emoji: '🌀',
        message: `L'aspirateur n'a pas été passé depuis ${retard.aspirateur.joursDepuis} jour${(retard.aspirateur.joursDepuis ?? 0) > 1 ? 's' : ''} (retard : ${j}j).`,
        actionLabel: 'Voir le ménage',
        actionRoute: '/menage',
      })
    }

    // M01 — Rappel ménage matinal
    if (estMatin && nbTachesMenageDuJour > 0) {
      push(68, {
        id: `menage-matin-${todayISO}`,
        variant: 'info',
        emoji: '🧹',
        message: `${nbTachesMenageDuJour} tâche${nbTachesMenageDuJour > 1 ? 's' : ''} ménagère${nbTachesMenageDuJour > 1 ? 's' : ''} vous attende${nbTachesMenageDuJour > 1 ? 'nt' : ''} aujourd'hui.`,
        actionLabel: 'Voir le ménage du jour',
        actionRoute: '/menage',
      })
    }

    return list
  }, [
    menusJoursRestants, nbCourses, nbTachesRetard, nbTachesMenageDuJour,
    activitesSemaineProchaine, menusSemanineProchaine, aRoutineMatin,
    habitudes, retard, jour, demain, heureDecimale, estMatin,
    todayISO, tomorrowISO,
  ])

  // ── Sélection : plus haute priorité non dismissée ─────────────────────────

  const notification = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => b.prio - a.prio)
    return sorted.find(({ notif }) => !isDismissed(notif.id))?.notif ?? null
  }, [candidates])

  const dismiss = useCallback(() => {
    if (notification) dismissNotification(notification.id)
  }, [notification])

  return { notification, dismiss }
}
