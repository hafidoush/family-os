/**
 * FAMILY OS — useHabituesRetard
 *
 * Calcule le retard en jours pour chaque habitude périodique (linge, aspirateur).
 * Cherche la dernière complétion d'une tâche correspondante dans Dexie,
 * compare avec la fréquence définie dans les habitudes.
 *
 * Retourne null quand aucune donnée disponible (jamais fait ou pas configuré).
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../core/db/database'
import { useHabitudes } from './useHabitudes'

// Fréquence → nombre de jours attendus entre deux passages
const FREQ_TO_DAYS: Record<string, number> = {
  quotidienne:    1,
  bihebdomadaire: 3,
  hebdomadaire:   7,
  bimensuelle:    14,
}

// Mots-clés pour identifier les tâches linge et aspirateur
const MOTS_LINGE       = ['linge', 'machine', 'lessive', 'étendre', 'plier', 'repasser']
const MOTS_ASPIRATEUR  = ['aspirateur', 'aspirer', 'balayer', 'sol', 'passer l\'aspir']

function matchesKeywords(titre: string, mots: string[]): boolean {
  const t = titre.toLowerCase()
  return mots.some(m => t.includes(m))
}

function joursDepuis(date: Date | undefined | null): number | null {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export interface RetardHabitude {
  /** Jours écoulés depuis la dernière complétion (null = jamais fait) */
  joursDepuis: number | null
  /** Nombre de jours attendus selon la fréquence */
  intervalleAttendu: number
  /** Jours de retard (positif = en retard, négatif = encore du temps) */
  retardJours: number | null
  /** true si en retard selon la fréquence configurée */
  enRetard: boolean
  /** true si très en retard (> 2× l'intervalle) */
  tresEnRetard: boolean
}

export interface HabituesRetard {
  linge:      RetardHabitude | null  // null = habitude non configurée
  aspirateur: RetardHabitude | null
}

function computeRetard(joursDepuisVal: number | null, frequence: string | undefined): RetardHabitude | null {
  if (!frequence) return null
  const intervalle = FREQ_TO_DAYS[frequence]
  if (!intervalle) return null

  const retardJours = joursDepuisVal !== null ? joursDepuisVal - intervalle : null
  return {
    joursDepuis:      joursDepuisVal,
    intervalleAttendu: intervalle,
    retardJours,
    enRetard:      retardJours !== null ? retardJours > 0 : false,
    tresEnRetard:  retardJours !== null ? retardJours > intervalle : false,
  }
}

export function useHabituesRetard(): HabituesRetard {
  const habitudes = useHabitudes()

  // Dernière complétion linge
  const dernierLinge = useLiveQuery(async () => {
    const taches = await db.taches
      .filter(t => !t.deletedAt && !t.archive && t.moduleOrigine === 'maison' && !!t.completeeLe)
      .toArray()
    const matching = taches.filter(t => matchesKeywords(t.titre ?? '', MOTS_LINGE))
    if (matching.length === 0) return null
    const dates = matching.map(t => new Date(t.completeeLe!).getTime())
    return new Date(Math.max(...dates))
  }, [])

  // Dernière complétion aspirateur
  const dernierAspirateur = useLiveQuery(async () => {
    const taches = await db.taches
      .filter(t => !t.deletedAt && !t.archive && t.moduleOrigine === 'maison' && !!t.completeeLe)
      .toArray()
    const matching = taches.filter(t => matchesKeywords(t.titre ?? '', MOTS_ASPIRATEUR))
    if (matching.length === 0) return null
    const dates = matching.map(t => new Date(t.completeeLe!).getTime())
    return new Date(Math.max(...dates))
  }, [])

  return useMemo(() => ({
    linge:      computeRetard(joursDepuis(dernierLinge ?? null),      habitudes.frequenceLinge),
    aspirateur: computeRetard(joursDepuis(dernierAspirateur ?? null), habitudes.frequenceAspirateur),
  }), [dernierLinge, dernierAspirateur, habitudes.frequenceLinge, habitudes.frequenceAspirateur])
}
