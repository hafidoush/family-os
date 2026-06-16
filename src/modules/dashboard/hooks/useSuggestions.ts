/**
 * FAMILY OS — useSuggestions
 *
 * Calcule dynamiquement les 3 suggestions contextuelles du dashboard.
 * Entièrement hors ligne : lit Dexie + heure/jour, sans appel réseau.
 *
 * Priorité des règles (ordre décroissant) :
 *  R01 — menus se terminent dans <= 2 jours
 *  R02 — jour de courses = aujourd'hui ou demain + liste vide
 *  R03 — courses vides (sans notion de jour prévu)
 *  R04 — tâches en retard
 *  R05 — activités enfants non planifiées la semaine prochaine
 *  R06 — dimanche matin → organiser la semaine
 *  R07 — mercredi / week-end → activités enfants
 *  R08 — matin (< 9h) → préparer la journée
 *  R09 — soir (>= 18h) → préparer demain
 *  R10 — fallback générique selon le jour
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../../core/db/database'
import { useHabitudes } from '../../../shared/hooks/useHabitudes'
import { useHabituesRetard } from '../../../shared/hooks/useHabituesRetard'

export interface Suggestion {
  label: string
  route: string
  state?: Record<string, string>
  badge?: string   // ex: "3 en retard", "Liste vide"
  urgent?: boolean
}

// ─── Helpers temporels ────────────────────────────────────────────────────────

function today(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ─── Requêtes Dexie ───────────────────────────────────────────────────────────

function parseHeure(hhmm: string | undefined, defaut: number): number {
  if (!hhmm) return defaut
  const [h, m] = hhmm.split(':').map(Number)
  return h + (m ?? 0) / 60
}

function useContexteData() {
  const now    = new Date()
  const heure  = now.getHours()
  const minutes = now.getMinutes()
  const heureDecimale = heure + minutes / 60
  const jour   = now.getDay() // 0=dim, 1=lun … 6=sam

  const todayISO       = toISO(today())
  const tomorrowISO    = toISO(addDays(today(), 1))
  const in2DaysISO     = toISO(addDays(today(), 2))

  // Début de la semaine prochaine (lundi)
  const diffLundi = (8 - jour) % 7 || 7
  const lundiProchain    = addDays(today(), diffLundi)
  const dimancheProchain = addDays(lundiProchain, 6)

  // ── Menus actifs : combien de jours restants ? ────────────────────────────
  const menusJoursRestants = useLiveQuery(async () => {
    const menus = await db.menus
      .filter(m => !m.deletedAt && !m.archive && !!m.dateFin)
      .toArray()
    if (menus.length === 0) return 0
    // Cherche le menu actif (dateDebut <= today <= dateFin)
    const actif = menus.find(m =>
      m.dateDebut <= todayISO && (m.dateFin ?? '9999') >= todayISO
    )
    if (!actif?.dateFin) return 0
    const fin  = new Date(actif.dateFin)
    const diff = Math.ceil((fin.getTime() - today().getTime()) / 86400000)
    return Math.max(0, diff)
  }, [todayISO]) ?? 99

  // ── Courses non cochées ───────────────────────────────────────────────────
  const nbCourses = useLiveQuery(
    () => db.coursesItems.filter(c => !c.deletedAt && !c.coche).count(),
    []
  ) ?? 0

  // ── Tâches en retard ──────────────────────────────────────────────────────
  const nbTachesRetard = useLiveQuery(async () => {
    const all = await db.taches
      .filter(t => !t.deletedAt && !t.archive && t.statut === 'a_faire' && !!t.dateEcheance)
      .toArray()
    return all.filter(t => new Date(t.dateEcheance!) < today()).length
  }, [todayISO]) ?? 0

  // ── Pensées actives non traitées ──────────────────────────────────────────
  const nbPensees = useLiveQuery(
    () => db.pensees.filter(p => !p.deletedAt && !p.archive && p.statut === 'active').count(),
    []
  ) ?? 0

  // ── Activités enfants la semaine prochaine ────────────────────────────────
  const activitesSemaineProchaine = useLiveQuery(async () => {
    const plans = await db.planificationsActivites
      .filter(p =>
        !p.deletedAt &&
        !p.archive &&
        p.datePrevue >= toISO(lundiProchain) &&
        p.datePrevue <= toISO(dimancheProchain)
      )
      .count()
    return plans
  }, [toISO(lundiProchain)]) ?? -1 // -1 = loading

  // ── Événements aujourd'hui ────────────────────────────────────────────────
  const nbEvtsAujourdhui = useLiveQuery(async () => {
    const all = await db.evenements
      .filter(e => !e.deletedAt && !e.archive)
      .toArray()
    return all.filter(e => {
      const d = new Date(e.dateDebut); d.setHours(0,0,0,0)
      return toISO(d) === todayISO
    }).length
  }, [todayISO]) ?? 0

  // ── Menus semaine prochaine ──────────────────────────────────────────────
  const menusSemanineProchaine = useLiveQuery(async () => {
    const lundiISO    = toISO(lundiProchain)
    const dimancheISO = toISO(dimancheProchain)
    return db.menus
      .filter(m => !m.deletedAt && !m.archive &&
        m.dateDebut >= lundiISO && m.dateDebut <= dimancheISO)
      .count()
  }, [toISO(lundiProchain)]) ?? -1

  return {
    heure, heureDecimale, jour,
    todayISO, tomorrowISO, in2DaysISO,
    menusJoursRestants,
    menusSemanineProchaine,
    nbCourses,
    nbTachesRetard,
    nbPensees,
    activitesSemaineProchaine,
    nbEvtsAujourdhui,
  }
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useSuggestions(): Suggestion[] {
  const ctx       = useContexteData()
  const habitudes = useHabitudes()
  const retard    = useHabituesRetard()

  return useMemo(() => {
    const {
      heure, heureDecimale, jour,
      menusJoursRestants, menusSemanineProchaine,
      nbCourses, nbTachesRetard, nbPensees,
      activitesSemaineProchaine,
    } = ctx

    // Fenêtres temporelles dynamiques (basées sur heureReveil/heureCoucher si configurées)
    const heureReveil  = parseHeure(habitudes.heureReveil,  7)
    const heureCoucher = parseHeure(habitudes.heureCoucher, 21)
    const estMatin     = heureDecimale >= heureReveil && heureDecimale < heureReveil + 2
    const estSoir      = heureDecimale >= heureCoucher - 1.5

    const demain = ((jour + 1) % 7) as 0|1|2|3|4|5|6

    // Pool de toutes les suggestions possibles, chacune avec sa condition
    const candidats: Array<{ prio: number; suggestion: Suggestion }> = []

    const push = (prio: number, s: Suggestion) =>
      candidats.push({ prio, suggestion: s })

    // R01 — Menus se terminent bientôt
    if (menusJoursRestants <= 2 && menusJoursRestants >= 0) {
      push(100, {
        label: 'Planifier les menus de la semaine prochaine',
        route: '/cuisine',
        badge: menusJoursRestants === 0 ? 'Expire aujourd\'hui' : `Expire dans ${menusJoursRestants}j`,
        urgent: true,
      })
    }

    // R02 — Courses vides (peu importe le jour)
    if (nbCourses === 0) {
      push(90, {
        label: 'Créer la liste de courses',
        route: '/courses',
        state: { tab: 'liste' },
        badge: 'Liste vide',
        urgent: true,
      })
    } else if (nbCourses > 0) {
      // Courses en cours → accès rapide
      push(30, {
        label: 'Voir ma liste de courses',
        route: '/courses',
        state: { tab: 'liste' },
        badge: `${nbCourses} article${nbCourses > 1 ? 's' : ''}`,
      })
    }

    // RH1 — Batch cooking demain (depuis habitudes)
    if (habitudes.jourBatchCooking !== undefined && habitudes.jourBatchCooking === demain) {
      push(95, {
        label: 'Préparer votre batch cooking de demain',
        route: '/cuisine',
        badge: 'Demain',
        urgent: true,
      })
    }

    // RH2 — Jour de courses aujourd'hui (depuis habitudes) + liste vide
    if (habitudes.jourCourses !== undefined && habitudes.jourCourses === jour && nbCourses === 0) {
      push(93, {
        label: 'Créer la liste de courses — c\'est votre jour !',
        route: '/courses',
        state: { tab: 'liste' },
        badge: 'Aujourd\'hui',
        urgent: true,
      })
    }

    // RH3 — Jour de courses demain (depuis habitudes) → anticiper
    if (habitudes.jourCourses !== undefined && habitudes.jourCourses === demain && nbCourses === 0) {
      push(88, {
        label: 'Préparer la liste de courses pour demain',
        route: '/courses',
        state: { tab: 'liste' },
        badge: 'Demain',
      })
    }

    // R03 — Tâches en retard
    if (nbTachesRetard > 0) {
      push(85, {
        label: 'Tâches en retard',
        route: '/maison',
        badge: `${nbTachesRetard} en retard`,
        urgent: true,
      })
    }

    // R04 — Pensées actives à traiter
    if (nbPensees >= 3) {
      push(70, {
        label: 'Traiter mes pensées en attente',
        route: '/pensees',
        badge: `${nbPensees} à traiter`,
      })
    }

    // R05 — Activités enfants non planifiées la semaine prochaine
    if (activitesSemaineProchaine === 0) {
      push(65, {
        label: 'Planifier les activités de la semaine prochaine',
        route: '/enfants',
      })
    }

    // R06 — Dimanche → organiser la semaine
    if (jour === 0) {
      push(60, {
        label: 'Planifier les activités de la semaine',
        route: '/famille',
      })
      push(55, {
        label: 'Préparer les menus de la semaine',
        route: '/cuisine',
      })
    }

    // R07 — Mercredi ou week-end → enfants
    if (jour === 3 || jour === 6 || jour === 0) {
      push(50, {
        label: 'Activités pour les enfants',
        route: '/enfants',
      })
    }

    // R08 — Matin (fenêtre dynamique basée sur heureReveil) → préparer la journée
    if (estMatin) {
      push(45, {
        label: 'Voir le planning du jour',
        route: '/programme-du-jour',
      })
      push(40, {
        label: 'Préparer la journée',
        route: '/dashboard',
      })
    }

    // R09 — Soir (fenêtre dynamique basée sur heureCoucher) → préparer demain
    if (estSoir) {
      push(45, {
        label: 'Préparer demain',
        route: '/programme-du-jour',
      })
      push(40, {
        label: 'Menu de ce soir',
        route: '/cuisine',
      })
    }

    // RH4 — Linge en retard
    if (retard.linge?.enRetard) {
      push(retard.linge.tresEnRetard ? 86 : 68, {
        label: 'Lancer le linge',
        route: '/menage',
        badge: retard.linge.tresEnRetard
          ? `${retard.linge.retardJours}j de retard`
          : `Retard ${retard.linge.retardJours}j`,
        urgent: retard.linge.tresEnRetard,
      })
    }

    // RH5 — Aspirateur en retard
    if (retard.aspirateur?.enRetard) {
      push(retard.aspirateur.tresEnRetard ? 80 : 62, {
        label: 'Passer l\'aspirateur',
        route: '/menage',
        badge: retard.aspirateur.tresEnRetard
          ? `${retard.aspirateur.retardJours}j de retard`
          : `Retard ${retard.aspirateur.retardJours}j`,
        urgent: retard.aspirateur.tresEnRetard,
      })
    }

    // A1 — Courses jour J avec liste non vide (rappel d'y aller)
    const demain2 = ((jour + 1) % 7) as 0|1|2|3|4|5|6
    if (habitudes.jourCourses === jour && nbCourses > 0 && heureDecimale >= 10) {
      push(91, {
        label: 'Faire les courses',
        route: '/courses',
        state: { tab: 'liste' },
        badge: `${nbCourses} article${nbCourses > 1 ? 's' : ''} prêts`,
        urgent: true,
      })
    }

    // A3 — Batch cooking jour J
    if (habitudes.jourBatchCooking === jour) {
      push(79, {
        label: 'Lancer le batch cooking',
        route: '/cuisine',
        badge: 'Aujourd\'hui',
      })
    }

    // A4 — Veille des courses + menus semaine prochaine absents
    if (habitudes.jourCourses === demain2 && menusSemanineProchaine === 0) {
      push(87, {
        label: 'Planifier les menus avant les courses de demain',
        route: '/cuisine',
        badge: 'Demain',
        urgent: true,
      })
    }

    // A6 — Batch demain + articles en liste (ingrédients batch à ajouter)
    if (habitudes.jourBatchCooking === demain2 && nbCourses > 0) {
      push(83, {
        label: 'Vérifier les ingrédients du batch cooking',
        route: '/cuisine',
        badge: 'Batch demain',
      })
    }

    // RH7 — Renouvellement menus (fréquence bihebdomadaire = alerter à J-3)
    if (habitudes.frequenceRenouvellementMenus === 'bihebdomadaire' && menusJoursRestants <= 3 && menusJoursRestants >= 0) {
      push(78, {
        label: 'Planifier les menus de la prochaine quinzaine',
        route: '/cuisine',
        badge: menusJoursRestants === 0 ? 'Expire aujourd\'hui' : `Expire dans ${menusJoursRestants}j`,
        urgent: menusJoursRestants <= 1,
      })
    }

    // R10 — Fallback générique (toujours disponibles, basse priorité)
    push(20, {
      label: 'Planifier les activités de la semaine',
      route: '/famille',
    })
    push(15, {
      label: 'Préparer mes courses',
      route: '/courses',
      state: { tab: 'produits' },
    })
    push(10, {
      label: 'Trouver des idées de repas',
      route: '/cuisine',
    })

    // Tri par priorité décroissante, dédoublonnage par route+label, top 3
    const seen = new Set<string>()
    return candidats
      .sort((a, b) => b.prio - a.prio)
      .filter(({ suggestion: s }) => {
        const key = s.label
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 3)
      .map(({ suggestion }) => suggestion)
  }, [ctx, habitudes, retard])
}
