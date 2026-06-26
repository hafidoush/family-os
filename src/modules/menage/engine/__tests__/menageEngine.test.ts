import { describe, it, expect } from 'vitest'
import {
  intervalFromFrequence,
  jitterDays,
  enrichTask,
  selectTasksForToday,
  computeMissedUpdates,
  computeSkipPatch,
  shouldAlertLevel3,
  computeInitialLastCompleted,
  computeNextDue,
  type MenageTask,
} from '../menageEngine'
import type { Tache } from '@shared/types/entities'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function day(offset: number): Date {
  const d = new Date('2026-06-26T00:00:00.000Z')
  d.setDate(d.getDate() + offset)
  return d
}

const TODAY = day(0)

let _seq = 0
function makeTask(overrides: Partial<Tache> & { _missedCount?: number; _difficulty?: 1|2|3; _visualImpact?: 1|2|3; _healthImportance?: 1|2|3 } = {}): Tache {
  const id = overrides.id ?? `task-${++_seq}`
  return {
    id,
    titre: overrides.titre ?? 'Tâche test',
    statut: 'a_faire',
    moduleOrigine: 'maison',
    recurrence: true,
    frequence: 'hebdomadaire',
    archive: false,
    createdAt: day(-30),
    updatedAt: day(-1),
    deviceId: 'test',
    completeeLe: day(-7), // due today par défaut
    ...overrides,
  } as Tache
}

// ─── intervalFromFrequence ────────────────────────────────────────────────────

describe('intervalFromFrequence', () => {
  it('retourne les bons intervalles', () => {
    expect(intervalFromFrequence('quotidienne')).toBe(1)
    expect(intervalFromFrequence('hebdomadaire')).toBe(7)
    expect(intervalFromFrequence('bihebdomadaire')).toBe(14)
    expect(intervalFromFrequence('mensuelle')).toBe(30)
    expect(intervalFromFrequence('trimestrielle')).toBe(90)
    expect(intervalFromFrequence('semestrielle')).toBe(180)
    expect(intervalFromFrequence('annuelle')).toBe(365)
    expect(intervalFromFrequence('ponctuelle')).toBe(0)
  })
})

// ─── jitterDays ───────────────────────────────────────────────────────────────

describe('jitterDays', () => {
  it('retourne 0 si toleranceWindow = 0', () => {
    expect(jitterDays('task-abc', 0)).toBe(0)
  })

  it('est stable pour le même ID', () => {
    const a = jitterDays('task-xyz', 5)
    const b = jitterDays('task-xyz', 5)
    expect(a).toBe(b)
  })

  it('reste dans la fenêtre [-window, +window]', () => {
    for (let i = 0; i < 50; i++) {
      const j = jitterDays(`task-${i}`, 5)
      expect(j).toBeGreaterThanOrEqual(-5)
      expect(j).toBeLessThanOrEqual(5)
    }
  })

  it('produit des valeurs distinctes pour des IDs différents', () => {
    const values = new Set(
      Array.from({ length: 20 }, (_, i) => jitterDays(`id-${i}`, 7))
    )
    // Statistiquement, 20 IDs distincts devraient produire au moins 5 valeurs uniques
    expect(values.size).toBeGreaterThan(4)
  })
})

// ─── enrichTask ──────────────────────────────────────────────────────────────

describe('enrichTask', () => {
  it('calcule overdueDays dans la fenêtre de tolérance pour une tâche nominalement due aujourd\'hui', () => {
    // Le jitter déterministe décale nextDue de ±toleranceWindow (±1 pour hebdo)
    // On vérifie donc que overdueDays est dans la fenêtre attendue, pas exactement 0
    const t = makeTask({ frequence: 'hebdomadaire', completeeLe: day(-7) })
    const enriched = enrichTask(t, TODAY)
    expect(Math.abs(enriched._overdueDays)).toBeLessThanOrEqual(enriched._toleranceWindow + 1)
  })

  it('calcule overdueDays positif pour une tâche en retard', () => {
    const t = makeTask({ frequence: 'hebdomadaire', completeeLe: day(-10) })
    const enriched = enrichTask(t, TODAY)
    expect(enriched._overdueDays).toBeGreaterThan(0)
  })

  it('calcule overdueDays négatif pour une tâche en avance', () => {
    const t = makeTask({ frequence: 'hebdomadaire', completeeLe: day(-3) })
    const enriched = enrichTask(t, TODAY)
    expect(enriched._overdueDays).toBeLessThan(0)
  })

  it('calcule un urgencyScore plus élevé pour une tâche en retard', () => {
    const onTime  = enrichTask(makeTask({ frequence: 'hebdomadaire', completeeLe: day(-7) }), TODAY)
    const overdue = enrichTask(makeTask({ frequence: 'hebdomadaire', completeeLe: day(-14) }), TODAY)
    expect(overdue._urgencyScore).toBeGreaterThan(onTime._urgencyScore)
  })

  it('utilise les valeurs par défaut pour les champs optionnels manquants', () => {
    const t = makeTask()
    const enriched = enrichTask(t, TODAY)
    expect(enriched._difficulty).toBe(2)
    expect(enriched._visualImpact).toBe(2)
    expect(enriched._healthImportance).toBe(1)
    expect(enriched._missedCount).toBe(0)
  })
})

// ─── selectTasksForToday ─────────────────────────────────────────────────────

describe('selectTasksForToday — sélection de base', () => {
  it('inclut les tâches quotidiennes', () => {
    const tasks = [
      makeTask({ id: 'daily-1', frequence: 'quotidienne', completeeLe: day(-1) }),
      makeTask({ id: 'daily-2', frequence: 'quotidienne', completeeLe: day(-1) }),
    ]
    const result = selectTasksForToday(tasks, TODAY)
    expect(result.map(t => t.id)).toContain('daily-1')
    expect(result.map(t => t.id)).toContain('daily-2')
  })

  it('n\'inclut pas les tâches archivées', () => {
    const tasks = [
      makeTask({ id: 'archived', archive: true, completeeLe: day(-7) }),
    ]
    const result = selectTasksForToday(tasks, TODAY)
    expect(result).toHaveLength(0)
  })

  it('n\'inclut pas les tâches en avance (hors fenêtre)', () => {
    // hebdomadaire complétée il y a 2 jours → nextDue dans 5 jours → hors fenêtre (±1)
    const t = makeTask({ id: 'future', frequence: 'hebdomadaire', completeeLe: day(-2) })
    const result = selectTasksForToday([t], TODAY)
    expect(result).toHaveLength(0)
  })

  it('trie par urgencyScore décroissant', () => {
    const tasks = [
      makeTask({ id: 'low',  frequence: 'hebdomadaire', completeeLe: day(-7)  }),
      makeTask({ id: 'high', frequence: 'hebdomadaire', completeeLe: day(-14) }),
    ]
    const result = selectTasksForToday(tasks, TODAY, 'grandMenage')
    // La tâche en plus grand retard doit apparaître en premier
    expect(result[0].id).toBe('high')
  })
})

// ─── Plafond de charge ────────────────────────────────────────────────────────

describe('selectTasksForToday — plafond de charge', () => {
  it('respecte difficultyCap en mode normal (7 pts)', () => {
    // 4 tâches "intensif" (difficulty 3) → cumulatif = 12, dépasse le cap de 7
    const tasks = Array.from({ length: 4 }, (_, i) =>
      makeTask({
        id: `hard-${i}`,
        frequence: 'hebdomadaire',
        completeeLe: day(-7),
        _difficulty: 3,
      } as Parameters<typeof makeTask>[0])
    )
    const result = selectTasksForToday(tasks, TODAY, 'normal')
    const totalDiff = result.reduce((s, t) => s + (t as MenageTask)._difficulty, 0)
    expect(totalDiff).toBeLessThanOrEqual(7)
  })

  it('accepte plus de charge en mode grandMenage (14 pts)', () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      makeTask({ id: `hard-${i}`, frequence: 'hebdomadaire', completeeLe: day(-7), _difficulty: 3 } as Parameters<typeof makeTask>[0])
    )
    const resultNormal   = selectTasksForToday(tasks, TODAY, 'normal')
    const resultGrandMen = selectTasksForToday(tasks, TODAY, 'grandMenage')
    expect(resultGrandMen.length).toBeGreaterThanOrEqual(resultNormal.length)
  })

  it('limite les tâches "intensif" à 1 en mode normal', () => {
    const tasks = Array.from({ length: 3 }, (_, i) =>
      makeTask({ id: `hard-${i}`, frequence: 'hebdomadaire', completeeLe: day(-7), _difficulty: 3 } as Parameters<typeof makeTask>[0])
    )
    const result = selectTasksForToday(tasks, TODAY, 'normal')
    const intensifs = result.filter(t => (t as MenageTask)._difficulty === 3)
    expect(intensifs.length).toBeLessThanOrEqual(1)
  })
})

// ─── Équilibre spatial ────────────────────────────────────────────────────────

describe('selectTasksForToday — équilibre spatial', () => {
  it('ne dépasse pas 40% de tâches par pièce quand des substituts existent', () => {
    // Mode normal (cap 7 pts, difficulty 2 par défaut → max 3 périodiques sélectionnées)
    // Cuisine très urgente → sélectionnée en premier → 2+ tâches cuisine dans les 3 slots
    // Salon + salle_de_bain restent sur le banc → disponibles comme substituts
    const tasks = [
      // Quotidienne sans pièce (bypass cap)
      makeTask({ id: 'd1', frequence: 'quotidienne', completeeLe: day(-1) }),
      // Cuisine très en retard → haute urgence → sélectionnées en priorité
      makeTask({ id: 'c1', frequence: 'hebdomadaire',   pieceAssociee: 'cuisine', completeeLe: day(-12) }),
      makeTask({ id: 'c2', frequence: 'hebdomadaire',   pieceAssociee: 'cuisine', completeeLe: day(-12) }),
      makeTask({ id: 'c3', frequence: 'bihebdomadaire', pieceAssociee: 'cuisine', completeeLe: day(-17) }),
      // Salon + salle_de_bain (moins urgents → sur le banc, disponibles comme substituts)
      makeTask({ id: 's1', frequence: 'hebdomadaire', pieceAssociee: 'salon',        completeeLe: day(-7) }),
      makeTask({ id: 's2', frequence: 'mensuelle',    pieceAssociee: 'salon',        completeeLe: day(-30) }),
      makeTask({ id: 'b1', frequence: 'hebdomadaire', pieceAssociee: 'salle_de_bain', completeeLe: day(-7) }),
    ]
    const result = selectTasksForToday(tasks, TODAY, 'normal')
    // La sélection doit contenir au moins 3 tâches pour que l'équilibre s'active
    if (result.length >= 3) {
      const cuisineCount = result.filter(t => t.pieceAssociee === 'cuisine').length
      expect(cuisineCount / result.length).toBeLessThanOrEqual(0.4 + 0.01)
    }
  })
})

// ─── Tâches non réalisées ─────────────────────────────────────────────────────

describe('computeMissedUpdates', () => {
  it('incrémente missedCount si tâche due hier non cochée', () => {
    const yesterday = day(-1)
    const t = makeTask({ frequence: 'hebdomadaire', completeeLe: day(-8), statut: 'a_faire' })
    const updates = computeMissedUpdates([t], yesterday)
    expect(updates).toHaveLength(1)
    expect(updates[0].missedCount).toBe(1)
  })

  it('ne retourne rien si la tâche a été cochée hier', () => {
    const yesterday = day(-1)
    const t = makeTask({
      frequence: 'hebdomadaire',
      completeeLe: day(-1),
      statut: 'fait',
    })
    const updates = computeMissedUpdates([t], yesterday)
    expect(updates).toHaveLength(0)
  })

  it('ne touche pas aux tâches non encore dues', () => {
    const yesterday = day(-1)
    // Completée il y a 2 jours → nextDue dans 5 jours → pas due hier
    const t = makeTask({ frequence: 'hebdomadaire', completeeLe: day(-2), statut: 'a_faire' })
    const updates = computeMissedUpdates([t], yesterday)
    expect(updates).toHaveLength(0)
  })
})

// ─── Skip "Pas aujourd'hui" ───────────────────────────────────────────────────

describe('computeSkipPatch', () => {
  it('incrémente missedCount et fixe skippedUntil à demain', () => {
    const t = makeTask({ frequence: 'hebdomadaire', completeeLe: day(-7) })
    const patch = computeSkipPatch(t, TODAY)
    expect(patch.missedCount).toBe(1)
    expect(patch.skippedUntil).not.toBeNull()
    const tomorrow = new Date(TODAY)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    expect(patch.skippedUntil?.toDateString()).toBe(tomorrow.toDateString())
  })
})

// ─── Alerte niveau 3 ─────────────────────────────────────────────────────────

describe('shouldAlertLevel3', () => {
  it('retourne true si missedCount >= 5 ET healthImportance >= 2', () => {
    const t = makeTask({ _missedCount: 5, _healthImportance: 2 } as Parameters<typeof makeTask>[0])
    const enriched = enrichTask(t, TODAY) as MenageTask
    ;(enriched as MenageTask)._missedCount = 5
    ;(enriched as MenageTask)._healthImportance = 2
    expect(shouldAlertLevel3(enriched)).toBe(true)
  })

  it('retourne false si missedCount < 5', () => {
    const t = makeTask({ _missedCount: 3, _healthImportance: 3 } as Parameters<typeof makeTask>[0])
    const enriched = enrichTask(t, TODAY) as MenageTask
    ;(enriched as MenageTask)._missedCount = 3
    ;(enriched as MenageTask)._healthImportance = 3
    expect(shouldAlertLevel3(enriched)).toBe(false)
  })

  it('retourne false si healthImportance = 1 même avec missedCount élevé', () => {
    const t = makeTask({ _missedCount: 10, _healthImportance: 1 } as Parameters<typeof makeTask>[0])
    const enriched = enrichTask(t, TODAY) as MenageTask
    ;(enriched as MenageTask)._missedCount = 10
    ;(enriched as MenageTask)._healthImportance = 1
    expect(shouldAlertLevel3(enriched)).toBe(false)
  })
})

// ─── Initialisation ───────────────────────────────────────────────────────────

describe('computeInitialLastCompleted', () => {
  it('retourne aujourd\'hui pour nouveauDepart', () => {
    const result = computeInitialLastCompleted(30, 'nouveauDepart')
    const today = new Date(); today.setHours(0,0,0,0)
    expect(result.toDateString()).toBe(today.toDateString())
  })

  it('retourne une date dans le passé pour entretien', () => {
    const result = computeInitialLastCompleted(30, 'entretien', 'ok')
    expect(result.getTime()).toBeLessThan(new Date().getTime())
  })

  it('retourne une date plus ancienne pour remiseEnOrdre/a_faire', () => {
    const ok      = computeInitialLastCompleted(30, 'remiseEnOrdre', 'ok')
    const a_faire = computeInitialLastCompleted(30, 'remiseEnOrdre', 'a_faire')
    expect(a_faire.getTime()).toBeLessThan(ok.getTime())
  })
})

// ─── Scénario end-to-end ──────────────────────────────────────────────────────

describe('Scénario end-to-end — une semaine type', () => {
  it('produit des sélections différentes pour deux jours éloignés', () => {
    // Deux séries de tâches mensuelles avec des completeeLe très différents
    // pour garantir que leur éligibilité change entre J et J+15
    const tasks = [
      makeTask({ id: 'q1', frequence: 'quotidienne', completeeLe: day(-1) }),
      makeTask({ id: 'm1', frequence: 'mensuelle', completeeLe: day(-30) }),  // due aujourd'hui
      makeTask({ id: 'm2', frequence: 'mensuelle', completeeLe: day(-15) }),  // due dans 15 jours
      makeTask({ id: 'm3', frequence: 'mensuelle', completeeLe: day(-28) }),  // due dans 2 jours
      makeTask({ id: 'm4', frequence: 'mensuelle', completeeLe: day(-20) }),  // due dans 10 jours
    ]

    const todayIds   = selectTasksForToday(tasks, TODAY,   'grandMenage').map(t => t.id).sort()
    const futureIds  = selectTasksForToday(tasks, day(15), 'grandMenage').map(t => t.id).sort()

    // J et J+15 doivent sélectionner des sous-ensembles différents de tâches mensuelles
    expect(todayIds).not.toEqual(futureIds)
  })

  it('les tâches mensuelles ne tombent pas toutes le même jour', () => {
    // 5 tâches mensuelles créées le même jour
    const tasks = Array.from({ length: 5 }, (_, i) =>
      makeTask({ id: `monthly-${i}`, frequence: 'mensuelle', completeeLe: day(-30) })
    )

    // Collecter les dates de nextDue
    const dueDates = tasks.map(t => {
      const e = enrichTask(t, TODAY)
      return e._overdueDays
    })

    // Grâce au jitter, les overdueDays doivent varier
    const unique = new Set(dueDates)
    expect(unique.size).toBeGreaterThan(1)
  })
})
