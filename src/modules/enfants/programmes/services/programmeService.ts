/**
 * FAMILY OS — Service CRUD Programmes Pédagogiques
 */

import { db } from '../../../../core/db/database'
import { newEntity, withUpdate, softDeleteFields } from '../../../../core/db/helpers'
import { emit } from '../../../../core/automation/engine'
import type {
  ProgrammePedagogique,
  ActiviteProgramme,
  ProgrammeAnnuel,
  SemaineProgramme,
  DureeProgramme,
  DifficulteActivite,
  StatutProgramme,
} from '../../../../shared/types'

// ─── Types formulaires ────────────────────────────────────────────────────────

export interface ProgrammeFormData {
  titre: string
  theme: string
  description?: string
  ageMin: number
  ageMax: number
  enfantsCibles: string[]              // Enfant.id[]
  duree: DureeProgramme
  frequenceParSemaine: number
  difficulte: DifficulteActivite
  objectifsPedagogiques: string[]
  competencesCiblees: string[]
  dateDebut: string                    // "YYYY-MM-DD"
  genereParIA?: boolean
  promptGeneration?: string
  modelIA?: string
}

export interface ActiviteProgrammeFormData {
  programmeId: string
  semaineNumero: number
  source: ActiviteProgramme['source']
  activiteCatalogueId?: string
  titre: string
  description: string
  objectifPedagogique: string
  phase: ActiviteProgramme['phase']
  competencesTravaillees: string[]
  materielNecessaire: ActiviteProgramme['materielNecessaire']
  materielOptionnel: ActiviteProgramme['materielOptionnel']
  tempsPreparation: number
  duree: number
  ageRecommande: string
  deroulement: ActiviteProgramme['deroulement']
  variantes?: ActiviteProgramme['variantes']
  ordre: number
}

// ─── Utilitaire : calculer la date de fin selon la durée ─────────────────────

export function calculerDateFin(dateDebut: string, duree: DureeProgramme): string {
  const debut = new Date(dateDebut)
  const fin = new Date(debut)
  switch (duree) {
    case 'hebdomadaire':  fin.setDate(debut.getDate() + 7);    break
    case 'mensuel':       fin.setMonth(debut.getMonth() + 1);  break
    case 'trimestriel':   fin.setMonth(debut.getMonth() + 3);  break
    case 'saisonnier':    fin.setMonth(debut.getMonth() + 3);  break
    case 'annuel':        fin.setFullYear(debut.getFullYear() + 1); break
  }
  return fin.toISOString().split('T')[0]
}

export function calculerNbSemaines(duree: DureeProgramme): number {
  switch (duree) {
    case 'hebdomadaire': return 1
    case 'mensuel':      return 4
    case 'trimestriel':  return 12
    case 'saisonnier':   return 12
    case 'annuel':       return 48
  }
}

// ─── Programmes CRUD ─────────────────────────────────────────────────────────

export async function createProgramme(
  data: ProgrammeFormData,
  semaines: SemaineProgramme[] = [],
): Promise<string> {
  const dateFin = calculerDateFin(data.dateDebut, data.duree)
  const programme = newEntity<ProgrammePedagogique>({
    ...data,
    dateFin,
    semaines,
    genereParIA: data.genereParIA ?? false,
    statut: 'brouillon' as StatutProgramme,
    progression: 0,
    archive: false,
  })
  await db.programmesPedagogiques.add(programme)
  return programme.id
}

export async function updateProgramme(
  id: string,
  partial: Partial<Omit<ProgrammePedagogique, 'id' | 'createdAt' | 'deviceId'>>,
): Promise<void> {
  await db.programmesPedagogiques.update(id, withUpdate(partial))
}

export async function updateSemaines(id: string, semaines: SemaineProgramme[]): Promise<void> {
  await db.programmesPedagogiques.update(id, withUpdate({ semaines }))
}

export async function activerProgramme(id: string): Promise<void> {
  await db.programmesPedagogiques.update(id, withUpdate({ statut: 'actif' as StatutProgramme }))
}

export async function archiverProgramme(id: string): Promise<void> {
  await db.programmesPedagogiques.update(id, softDeleteFields())
  // Archiver toutes les activités associées
  const activites = await db.activitesProgramme.where('programmeId').equals(id).toArray()
  await Promise.all(activites.map(a => db.activitesProgramme.update(a.id, softDeleteFields())))
}

// ─── Calcul de progression (à jour après chaque realisation) ─────────────────

export async function recalculerProgression(programmeId: string): Promise<void> {
  const activites = await db.activitesProgramme
    .where('programmeId').equals(programmeId)
    .filter(a => !a.archive)
    .toArray()
  if (activites.length === 0) return
  const realisees = activites.filter(a => a.statutRealisation === 'realise').length
  const progression = Math.round((realisees / activites.length) * 100)
  await db.programmesPedagogiques.update(programmeId, withUpdate({ progression }))
}

// ─── Activités CRUD ──────────────────────────────────────────────────────────

export async function createActiviteProgramme(data: ActiviteProgrammeFormData): Promise<string> {
  const activite = newEntity<ActiviteProgramme>({
    ...data,
    statutRealisation: 'a_faire',
    archive: false,
  })
  await db.activitesProgramme.add(activite)
  return activite.id
}

export async function marquerActiviteRealisee(
  activiteId: string,
  notes?: string,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  await db.activitesProgramme.update(activiteId, withUpdate({
    statutRealisation: 'realise',
    dateRealisation: today,
    ...(notes ? { notesParent: notes } : {}),
  }))
  const activite = await db.activitesProgramme.get(activiteId)
  if (activite) {
    await recalculerProgression(activite.programmeId)
    const programme = await db.programmesPedagogiques.get(activite.programmeId)
    if (programme) {
      await emit('activite_programme.realised', {
        activite,
        programmeId: activite.programmeId,
        enfantsCibles: programme.enfantsCibles,
      }, 'enfants')
    }
  }
}

export async function marquerActiviteSautee(activiteId: string): Promise<void> {
  await db.activitesProgramme.update(activiteId, withUpdate({ statutRealisation: 'saute' }))
  const activite = await db.activitesProgramme.get(activiteId)
  if (activite) await recalculerProgression(activite.programmeId)
}

export async function reordonnerActivites(
  programmeId: string,
  semaineNumero: number,
  orderedIds: string[],
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db.activitesProgramme.update(id, withUpdate({ ordre: index }))
    )
  )
}

export async function deleteActiviteProgramme(activiteId: string): Promise<void> {
  await db.activitesProgramme.update(activiteId, softDeleteFields())
}

// ─── Tâches de préparation ────────────────────────────────────────────────────

export async function marquerTachePreparationFaite(
  programmeId: string,
  semaineNumero: number,
  tacheId: string,
): Promise<void> {
  const programme = await db.programmesPedagogiques.get(programmeId)
  if (!programme) return
  const semaines = programme.semaines.map(s => {
    if (s.numero !== semaineNumero) return s
    return {
      ...s,
      tachesPreparation: s.tachesPreparation.map(t =>
        t.id === tacheId ? { ...t, faite: true } : t
      ),
    }
  })
  await db.programmesPedagogiques.update(programmeId, withUpdate({ semaines }))
}

// ─── Programme Annuel CRUD ────────────────────────────────────────────────────

export async function createProgrammeAnnuel(
  annee: number,
  enfantsCibles: string[],
  repartitionMensuelle: ProgrammeAnnuel['repartitionMensuelle'],
  genereParIA: boolean,
): Promise<string> {
  const pa = newEntity<ProgrammeAnnuel>({
    annee,
    enfantsCibles,
    repartitionMensuelle,
    programmesIds: [],
    genereParIA,
    statut: 'brouillon',
    archive: false,
  })
  await db.programmesAnnuels.add(pa)
  return pa.id
}

export async function lierProgrammeAnnuel(
  programmeAnnuelId: string,
  programmeId: string,
): Promise<void> {
  const pa = await db.programmesAnnuels.get(programmeAnnuelId)
  if (!pa) return
  const programmesIds = [...new Set([...pa.programmesIds, programmeId])]
  await db.programmesAnnuels.update(programmeAnnuelId, withUpdate({ programmesIds }))
}

export async function updateRepartitionMois(
  programmeAnnuelId: string,
  repartitionMensuelle: ProgrammeAnnuel['repartitionMensuelle'],
): Promise<void> {
  await db.programmesAnnuels.update(programmeAnnuelId, withUpdate({ repartitionMensuelle }))
}
