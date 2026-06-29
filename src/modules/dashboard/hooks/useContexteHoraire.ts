import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db/database'
import { useHabitudes } from '../../../shared/hooks/useHabitudes'
import { toISODate } from '../../../shared/utils/formatDate'
import { getInfoJour } from '../../../shared/utils/calendrierScolaire'

export interface ChipContextuel {
  id?: string
  label: string
  route?: string
  action?: () => void
  selected?: boolean
  badge?: string
  recetteId?: string
}

export interface RepasDisponible {
  id: string
  nom: string
  recetteId?: string
  jour?: string
}

export interface DinerCeSoir {
  nom: string
  recetteId?: string
  image?: Blob
  imageData?: string
  accompagnements?: string[]
}

export interface ContexteHoraire {
  moment: 'matin' | 'midi' | 'aprem_soir' | 'nuit'
  titre: string
  sousTitre: string
  chips: ChipContextuel[]
  repasDisponibles: RepasDisponible[]
  dinerCeSoir: DinerCeSoir | null | undefined
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
    const now2 = new Date()
    const y = now2.getFullYear(), mo = now2.getMonth(), d2 = now2.getDate()
    const plans = await db.planificationsActivites
      .filter(p => {
        if (p.deletedAt || p.archive) return false
        const dp = new Date(p.datePrevue)
        return dp.getFullYear() === y && dp.getMonth() === mo && dp.getDate() === d2
      })
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

  // Midi + Aprem/Soir : pool de recettes du menu de la semaine (boutons de sélection dîner)
  // Uniquement les slots d'aujourd'hui et des jours à venir dans la semaine
  const repasDisponibles = useLiveQuery(async (): Promise<RepasDisponible[]> => {
    if (moment !== 'aprem_soir' && moment !== 'midi') return []
    const menus = await db.menus
      .filter(m =>
        !m.deletedAt &&
        m.dateDebut <= todayISO &&
        (m.dateFin == null || m.dateFin >= todayISO)
      )
      .toArray()
    if (!menus.length) return []
    const menu = menus.find(m => m.valide) ?? menus.sort((a, b) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? ''))[0]
    const slots = await db.menuSlots
      .where('menu').equals(menu.id)
      .filter(s => !s.deletedAt && (s.jour == null) && (!!s.recette || !!s.descriptionLibre))
      .toArray()
    if (!slots.length) return []
    const ids = [...new Set(slots.map(s => s.recette).filter(Boolean) as string[])]
    const recettes = ids.length ? await db.recettes.where('id').anyOf(ids).toArray() : []
    const recMap = new Map(recettes.map(r => [r.id, r]))
    return slots.map(s => ({
      id: s.id,
      nom: s.recette ? (recMap.get(s.recette)?.nom ?? s.descriptionLibre ?? '—') : (s.descriptionLibre ?? '—'),
      recetteId: s.recette ?? undefined,
      jour: s.jour,
    }))
  }, [moment, todayISO]) ?? []

  // Midi + Aprem/Soir : dîner du soir sélectionné
  const dinerCeSoir = useLiveQuery(async (): Promise<DinerCeSoir | null> => {
    if (moment !== 'midi' && moment !== 'aprem_soir') return null
    const menus = await db.menus
      .filter(m => !m.deletedAt && m.dateDebut <= todayISO && (m.dateFin == null || m.dateFin >= todayISO))
      .toArray()
    if (!menus.length) return null
    const menu = menus.find(m => m.valide) ?? menus.sort((a, b) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? ''))[0]
    const jourAuj = JOUR_NOM[new Date().getDay()]
    const slot = await db.menuSlots
      .where('menu').equals(menu.id)
      .filter(s => !s.deletedAt && s.jour === jourAuj && s.repas === 'diner')
      .first()
    if (!slot) return null
    if (!slot.recette) return { nom: slot.descriptionLibre ?? 'Dîner prévu' }
    const recette = await db.recettes.get(slot.recette)
    return {
      nom: recette?.nom ?? '—',
      recetteId: slot.recette,
      image: recette?.image,
      imageData: recette?.imageData,
    }
  }, [moment, todayISO])

  // Nuit : aperçu de demain
  const activitesDemain = useLiveQuery(async () => {
    if (moment !== 'nuit') return []
    const dem = new Date(); dem.setDate(dem.getDate() + 1)
    const dy = dem.getFullYear(), dmo = dem.getMonth(), dd = dem.getDate()
    const plans = await db.planificationsActivites
      .filter(p => {
        if (p.deletedAt || p.archive) return false
        const dp = new Date(p.datePrevue)
        return dp.getFullYear() === dy && dp.getMonth() === dmo && dp.getDate() === dd
      })
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
      return { moment, titre: 'Une nouvelle journée', sousTitre: sousTitre || 'Tout est là pour commencer sereinement', chips, repasDisponibles: [], dinerCeSoir: null }
    }

    if (moment === 'midi') {
      const nbActiv = activitesAujourdhui.length
      const hasDiner = dinerCeSoir != null

      // Sous-titre : activités (max 2) + question dîner si pas encore choisi
      const sousParts: string[] = []
      if (nbActiv > 0) sousParts.push(activitesAujourdhui.slice(0, 2).join(' · '))
      if (!hasDiner) sousParts.push("Qu'est-ce qu'on mange ce soir ?")
      const sousTitre = sousParts.join(' · ') || 'Tout avance à son rythme'

      // Chips : activités + tâches (le dîner choisi a sa propre carte dédiée)
      const chips: ChipContextuel[] = []
      chips.push({ label: 'Activités', route: '/enfants', ...(nbActiv > 0 ? { badge: `${nbActiv}` } : {}) })
      chips.push({ label: 'Mes tâches', route: '/maison' })

      return { moment, titre: 'Le cœur de la journée', sousTitre, chips, repasDisponibles, dinerCeSoir }
    }

    if (moment === 'aprem_soir') {
      const titreSoir = heure < 18 ? "L'après-midi continue" : 'La soirée commence'

      const sousParts: string[] = []
      if (badgeEcoleDem) sousParts.push(badgeEcoleDem)
      const sousTitre = sousParts.join(' · ') || (heure < 18 ? 'Ce soir se prépare doucement' : 'Le reste attendra demain')

      const chips: ChipContextuel[] = []

      return { moment, titre: titreSoir, sousTitre, chips, repasDisponibles, dinerCeSoir }
    }

    // nuit
    const titre = 'Bonne nuit'
    const partsDemain: string[] = []
    if (infoDem.pasEcole && infoDem.raison) partsDemain.push(infoDem.raison === 'Samedi' || infoDem.raison === 'Dimanche' ? '' : `Pas d'école · ${infoDem.raison}`)
    if (infoDem.ferie && infoDem.labelFerie) partsDemain.push(infoDem.labelFerie)
    if (activitesDemain.length > 0) partsDemain.push(`${activitesDemain.length} activité${activitesDemain.length > 1 ? 's' : ''}`)
    if (evtsDemain > 0) partsDemain.push(`${evtsDemain} événement${evtsDemain > 1 ? 's' : ''}`)
    if (tachesDemain > 0) partsDemain.push(`${tachesDemain} tâche${tachesDemain > 1 ? 's' : ''}`)
    const sousTitre = partsDemain.filter(Boolean).join(' · ') || 'Demain prendra soin de lui-même'
    const chips: ChipContextuel[] = [
      ...(activitesDemain.length > 0 ? [{ label: `${activitesDemain.length} activité${activitesDemain.length > 1 ? 's' : ''}`, route: '/enfants' }] : []),
      ...(evtsDemain > 0 ? [{ label: `${evtsDemain} événement${evtsDemain > 1 ? 's' : ''}`, route: '/famille' }] : []),
      ...(tachesDemain > 0 ? [{ label: `${tachesDemain} tâche${tachesDemain > 1 ? 's' : ''}`, route: '/maison' }] : []),
      { label: 'Voir demain', route: '/programme-du-jour' },
    ].slice(0, 3)
    return { moment, titre, sousTitre, chips, repasDisponibles: [], dinerCeSoir: null }

  }, [moment, heure, activitesAujourdhui, tachesMatinales, repasDisponibles, dinerCeSoir, activitesDemain, evtsDemain, tachesDemain, jourIdx])
}
