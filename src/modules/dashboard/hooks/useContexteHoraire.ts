import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { useHabitudes } from '../../../shared/hooks/useHabitudes'
import { toISODate } from '../../../shared/utils/formatDate'
import { getInfoJour } from '../../../shared/utils/calendrierScolaire'

export interface ChipContextuel {
  label: string
  route?: string
  action?: () => void
  selected?: boolean
  badge?: string
}

export interface ContexteHoraire {
  moment: 'matin' | 'midi' | 'aprem_soir' | 'nuit'
  titre: string
  sousTitre: string
  chips: ChipContextuel[]
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function today(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}

const JOUR_NOM = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

function parseHeure(hhmm: string | undefined, defaut: number): number {
  if (!hhmm) return defaut
  const [h, m] = hhmm.split(':').map(Number)
  return h + (m ?? 0) / 60
}

export function useContexteHoraire(): ContexteHoraire {
  const habitudes = useHabitudes()
  const now = new Date()
  const heure = now.getHours() + now.getMinutes() / 60
  const todayISO = toISO(today())
  const tomorrowISO = toISO(new Date(today().getTime() + 86400000))
  const jourIdx = now.getDay()

  const heureReveil  = parseHeure(habitudes.heureReveil, 6)
  const heureCoucher = parseHeure(habitudes.heureCoucher, 21)

  const moment: ContexteHoraire['moment'] =
    heure >= heureCoucher || heure < heureReveil ? 'nuit'
    : heure < 11 ? 'matin'
    : heure < 14 ? 'midi'
    : 'aprem_soir'

  // ── Données selon le moment ────────────────────────────────────────────────

  // Matin : activités + tâches ménagères du jour
  const activitesAujourdhui = useLiveQuery(async () => {
    if (moment !== 'matin' && moment !== 'midi') return []
    const plans = await db.planificationsActivites
      .filter(p => !p.deletedAt && !p.archive && p.datePrevue === todayISO)
      .toArray()
    if (!plans.length) return []
    const ids = [...new Set(plans.map(p => p.activite))]
    const activites = await db.activites.where('id').anyOf(ids).toArray()
    const map = new Map(activites.map(a => [a.id, a]))
    return plans.map(p => map.get(p.activite)?.nom ?? '').filter(Boolean)
  }, [moment, todayISO]) ?? []

  const tachesMatinales = useLiveQuery(async () => {
    if (moment !== 'matin') return []
    const all = await db.taches
      .filter(t => !t.deletedAt && !t.archive && t.statut === 'a_faire')
      .toArray()
    return all
      .filter(t => {
        if (!t.dateEcheance) return false
        const d = new Date(t.dateEcheance); d.setHours(0,0,0,0)
        return toISO(d) === todayISO
      })
      .slice(0, 3)
      .map(t => t.titre)
  }, [moment, todayISO]) ?? []

  // Aprem/Soir : dîners de la semaine (pool à choisir)
  const repasDisponibles = useLiveQuery(async () => {
    if (moment !== 'aprem_soir') return []
    const menus = await db.menus
      .filter(m => !m.deletedAt && !m.archive && m.dateDebut <= todayISO && (m.dateFin == null || m.dateFin >= todayISO))
      .toArray()
    if (!menus.length) return []
    const menu = menus[0]
    const slots = await db.menuSlots
      .where('menu').equals(menu.id)
      .filter(s => !s.deletedAt && s.repas === 'diner' && (!!s.recette || !!s.descriptionLibre))
      .toArray()
    if (!slots.length) return []
    const ids = [...new Set(slots.map(s => s.recette).filter(Boolean) as string[])]
    const recettes = ids.length ? await db.recettes.where('id').anyOf(ids).toArray() : []
    const recMap = new Map(recettes.map(r => [r.id, r]))
    return slots.map(s => {
      const nom = s.recette ? (recMap.get(s.recette)?.nom ?? s.descriptionLibre ?? '—') : (s.descriptionLibre ?? '—')
      return { id: s.id, nom, jour: s.jour }
    })
  }, [moment, todayISO]) ?? []

  // Nuit : aperçu de demain
  const activitesDemain = useLiveQuery(async () => {
    if (moment !== 'nuit') return []
    const plans = await db.planificationsActivites
      .filter(p => !p.deletedAt && !p.archive && p.datePrevue === tomorrowISO)
      .toArray()
    if (!plans.length) return []
    const ids = [...new Set(plans.map(p => p.activite))]
    const activites = await db.activites.where('id').anyOf(ids).toArray()
    const map = new Map(activites.map(a => [a.id, a]))
    return plans.map(p => map.get(p.activite)?.nom ?? '').filter(Boolean)
  }, [moment, tomorrowISO]) ?? []

  const evtsDemain = useLiveQuery(async () => {
    if (moment !== 'nuit') return 0
    const all = await db.evenements.filter(e => !e.deletedAt && !e.archive).toArray()
    return all.filter(e => {
      const d = new Date(e.dateDebut); d.setHours(0,0,0,0)
      return toISO(d) === tomorrowISO
    }).length
  }, [moment, tomorrowISO]) ?? 0

  const tachesDemain = useLiveQuery(async () => {
    if (moment !== 'nuit') return 0
    const all = await db.taches
      .filter(t => !t.deletedAt && !t.archive && t.statut === 'a_faire' && !!t.dateEcheance)
      .toArray()
    return all.filter(t => {
      const d = new Date(t.dateEcheance!); d.setHours(0,0,0,0)
      return toISO(d) === tomorrowISO
    }).length
  }, [moment, tomorrowISO]) ?? 0

  return useMemo((): ContexteHoraire => {
    const infoAuj   = getInfoJour(new Date())
    const demainDate = new Date(); demainDate.setDate(demainDate.getDate() + 1)
    const infoDem   = getInfoJour(demainDate)

    // Badge "pas d'école" pour aujourd'hui
    const badgeEcoleAuj: string | null =
      infoAuj.vacances   ? infoAuj.raison ?? 'Vacances'
      : infoAuj.ferie    ? infoAuj.labelFerie ?? 'Jour férié'
      : infoAuj.pasEcole ? null  // sam/dim : évident, pas besoin de badge
      : null

    // Badge "pas d'école demain"
    const badgeEcoleDem: string | null =
      infoDem.vacances   ? infoDem.raison ?? 'Vacances'
      : infoDem.ferie    ? infoDem.labelFerie ?? 'Jour férié'
      : infoDem.raison === 'Mercredi' ? 'Pas d\'école demain'
      : null

    if (moment === 'matin') {
      const nbActiv = activitesAujourdhui.length
      const parts: string[] = []
      if (badgeEcoleAuj) parts.push(badgeEcoleAuj)
      if (nbActiv > 0) parts.push(activitesAujourdhui.slice(0, 2).join(' · ') + (nbActiv > 2 ? ` · +${nbActiv - 2}` : ''))
      const sousTitre = parts.join(' · ') || 'Aucune activité planifiée'
      const chips: ChipContextuel[] = [
        ...tachesMatinales.slice(0, 2).map(t => ({ label: t, route: '/maison' })),
        ...(nbActiv > 0 ? [{ label: `${nbActiv} activité${nbActiv > 1 ? 's' : ''} du jour`, route: '/enfants' }] : []),
      ].slice(0, 3)
      if (!chips.length) {
        chips.push({ label: 'Voir le planning', route: '/programme-du-jour' })
        chips.push({ label: 'Mes tâches', route: '/maison' })
      }
      return { moment, titre: 'Ce matin', sousTitre, chips }
    }

    if (moment === 'midi') {
      const nbActiv = activitesAujourdhui.length
      const parts: string[] = []
      if (badgeEcoleDem) parts.push(badgeEcoleDem)
      if (nbActiv > 0) parts.push(activitesAujourdhui.slice(0, 2).join(' · '))
      const sousTitre = parts.join(' · ') || 'Rien de prévu cet après-midi'
      const chips: ChipContextuel[] = [
        { label: 'Activités', route: '/enfants', ...(nbActiv > 0 ? { badge: `${nbActiv}` } : {}) },
        { label: 'Choisir le dîner', route: '/cuisine' },
        { label: 'Mes tâches', route: '/maison' },
      ]
      return { moment, titre: 'Cet après-midi', sousTitre, chips }
    }

    if (moment === 'aprem_soir') {
      const nbRepas = repasDisponibles.length
      const parts: string[] = []
      if (badgeEcoleDem) parts.push(badgeEcoleDem)
      parts.push(nbRepas > 0 ? `${nbRepas} repas prévus cette semaine` : 'Aucun repas planifié')
      const sousTitre = parts.join(' · ')
      const chips: ChipContextuel[] = nbRepas > 0
        ? repasDisponibles.slice(0, 4).map(r => ({ label: r.nom, route: '/cuisine' }))
        : [{ label: 'Planifier les repas', route: '/cuisine' }]
      return { moment, titre: 'Ce soir', sousTitre, chips }
    }

    // nuit
    const jourLabel = JOUR_NOM[(jourIdx + 1) % 7]
    const jourCapitalize = jourLabel.charAt(0).toUpperCase() + jourLabel.slice(1)
    const nbTotal = activitesDemain.length + evtsDemain + tachesDemain
    const partsDemain: string[] = []
    if (infoDem.pasEcole && infoDem.raison) partsDemain.push(infoDem.raison === 'Samedi' || infoDem.raison === 'Dimanche' ? '' : `Pas d'école · ${infoDem.raison}`)
    if (infoDem.ferie && infoDem.labelFerie) partsDemain.push(infoDem.labelFerie)
    if (activitesDemain.length > 0) partsDemain.push(`${activitesDemain.length} activité${activitesDemain.length > 1 ? 's' : ''}`)
    if (evtsDemain > 0) partsDemain.push(`${evtsDemain} événement${evtsDemain > 1 ? 's' : ''}`)
    if (tachesDemain > 0) partsDemain.push(`${tachesDemain} tâche${tachesDemain > 1 ? 's' : ''}`)
    const sousTitre = partsDemain.filter(Boolean).join(' · ') || 'Journée calme demain'
    const chips: ChipContextuel[] = [
      ...(activitesDemain.length > 0 ? [{ label: `${activitesDemain.length} activité${activitesDemain.length > 1 ? 's' : ''}`, route: '/enfants' }] : []),
      ...(evtsDemain > 0 ? [{ label: `${evtsDemain} événement${evtsDemain > 1 ? 's' : ''}`, route: '/famille' }] : []),
      ...(tachesDemain > 0 ? [{ label: `${tachesDemain} tâche${tachesDemain > 1 ? 's' : ''}`, route: '/maison' }] : []),
      { label: 'Voir demain', route: '/programme-du-jour' },
    ].slice(0, 3)
    return { moment, titre: jourCapitalize, sousTitre, chips }

  }, [moment, activitesAujourdhui, tachesMatinales, repasDisponibles, activitesDemain, evtsDemain, tachesDemain, jourIdx])
}
