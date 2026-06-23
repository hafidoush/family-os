import { describe, it, expect } from 'vitest'

// ─── Logique de remontée du score après ménage ────────────────────────────────

function calculerIncrement(dureeEstimee: number): number {
  return Math.min(30, Math.floor(dureeEstimee / 10) * 5 + 5)
}

function calculerNouveauScore(scoreActuel: number, increment: number): number {
  return Math.min(100, scoreActuel + increment)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('A-14 — Remontée du score après tâche ménage', () => {

  it('une tâche de 30 min apporte +20 points', () => {
    const increment = calculerIncrement(30)
    expect(increment).toBe(20)
  })

  it('ne dépasse jamais 100', () => {
    const score = calculerNouveauScore(95, 20)
    expect(score).toBe(100)
  })

  it('une pièce urgente (score=10) remonte bien après nettoyage', () => {
    const increment = calculerIncrement(45)
    const score = calculerNouveauScore(10, increment)
    expect(score).toBeGreaterThan(10)
    expect(score).toBeLessThanOrEqual(100)
  })

  it("l'incrément maximum est plafonné à 30 points peu importe la durée", () => {
    const increment = calculerIncrement(999)
    expect(increment).toBe(30)
  })

  it('une tâche de 10 min apporte +10 points minimum', () => {
    const increment = calculerIncrement(10)
    expect(increment).toBeGreaterThanOrEqual(10)
  })
})
