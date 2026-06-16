/**
 * FAMILY OS — Hooks Programmes Pédagogiques
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../../../core/db/database'
import { getPreparationSemaine } from '../services/preparationService'
import type { BilanPreparation } from '../services/preparationService'

// ─── Liste de tous les programmes (non archivés) ──────────────────────────────

export function useProgrammes(enfantId?: string) {
  return useLiveQuery(
    () => {
      if (enfantId) {
        return db.programmesPedagogiques
          .where('enfantsCibles').equals(enfantId)
          .filter(p => !p.archive && !p.deletedAt)
          .sortBy('dateDebut')
      }
      return db.programmesPedagogiques
        .filter(p => !p.archive && !p.deletedAt)
        .sortBy('dateDebut')
    },
    [enfantId],
    []
  )
}

// ─── Programme actif (statut = 'actif') ──────────────────────────────────────

export function useProgrammesActifs(enfantId?: string) {
  return useLiveQuery(
    () => {
      if (enfantId) {
        return db.programmesPedagogiques
          .where('enfantsCibles').equals(enfantId)
          .filter(p => p.statut === 'actif' && !p.archive && !p.deletedAt)
          .toArray()
      }
      return db.programmesPedagogiques
        .where('statut').equals('actif')
        .filter(p => !p.archive && !p.deletedAt)
        .toArray()
    },
    [enfantId],
    []
  )
}

// ─── Détail d'un programme avec ses activités ─────────────────────────────────

export function useProgrammeDetail(programmeId: string | null) {
  const programme = useLiveQuery(
    () => programmeId ? db.programmesPedagogiques.get(programmeId) : undefined,
    [programmeId]
  )

  const activites = useLiveQuery(
    async () => {
      if (!programmeId) return []
      return db.activitesProgramme
        .where('programmeId').equals(programmeId)
        .filter(a => !a.archive && !a.deletedAt)
        .sortBy('ordre')
    },
    [programmeId],
    []
  )

  return {
    programme: programme ?? null,
    activites,
    isLoading: programme === undefined,
  }
}

// ─── Activités d'une semaine précise ─────────────────────────────────────────

export function useActivitesSemaine(programmeId: string | null, semaineNumero: number) {
  return useLiveQuery(
    async () => {
      if (!programmeId) return []
      return db.activitesProgramme
        .where(['programmeId', 'semaineNumero'])
        .equals([programmeId, semaineNumero])
        .filter(a => !a.archive && !a.deletedAt)
        .sortBy('ordre')
    },
    [programmeId, semaineNumero],
    []
  )
}

// ─── Bilan préparation semaine (non-réactif — chargé à la demande) ────────────

export function usePreparationSemaine() {
  const [bilan, setBilan] = useState<BilanPreparation | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Recharger à chaque changement de programme actif
  const programmesActifs = useProgrammesActifs()

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getPreparationSemaine().then(b => {
      if (!cancelled) { setBilan(b); setIsLoading(false) }
    })
    return () => { cancelled = true }
  }, [programmesActifs])

  return { bilan, isLoading }
}

// ─── Programmes annuels ───────────────────────────────────────────────────────

export function useProgrammesAnnuels(enfantId?: string) {
  return useLiveQuery(
    () => {
      if (enfantId) {
        return db.programmesAnnuels
          .where('enfantsCibles').equals(enfantId)
          .filter(pa => !pa.archive && !pa.deletedAt)
          .toArray()
      }
      return db.programmesAnnuels.filter(pa => !pa.archive && !pa.deletedAt).toArray()
    },
    [enfantId],
    []
  )
}

export function useProgrammeAnnuelDetail(id: string | null) {
  const pa = useLiveQuery(
    () => id ? db.programmesAnnuels.get(id) : undefined,
    [id]
  )

  const programmes = useLiveQuery(
    async () => {
      if (!pa || pa.programmesIds.length === 0) return []
      return db.programmesPedagogiques
        .where('id').anyOf(pa.programmesIds)
        .filter(p => !p.archive && !p.deletedAt)
        .toArray()
    },
    [pa],
    []
  )

  return {
    programmeAnnuel: pa ?? null,
    programmes,
    isLoading: pa === undefined,
  }
}
