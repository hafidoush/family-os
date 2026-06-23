import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── La logique de dégradation extraite pour être testable ───────────────────
// On teste la LOGIQUE pure, sans Dexie

function calculerNouveauScore(scoreActuel: number, tauxDegradation: number, joursSansEntretien: number): number {
  if (tauxDegradation === 0 || joursSansEntretien < 1) return scoreActuel
  return Math.max(0, scoreActuel - tauxDegradation)
}

function calculerEtatGeneral(score: number): 'tres_propre' | 'propre' | 'a_entretenir' | 'urgent' {
  if (score >= 80) return 'tres_propre'
  if (score >= 50) return 'propre'
  if (score >= 20) return 'a_entretenir'
  return 'urgent'
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('A-13 — Dégradation du score de propreté', () => {

  it('diminue le score selon le taux de dégradation', () => {
    const score = calculerNouveauScore(80, 5, 1)
    expect(score).toBe(75)
  })

  it('ne passe jamais en négatif', () => {
    // Pièce très sale + taux élevé
    const score = calculerNouveauScore(3, 10, 1)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBe(0)
  })

  it('ne dégrade pas si taux = 0 (pièce non suivie)', () => {
    const score = calculerNouveauScore(60, 0, 5)
    expect(score).toBe(60)
  })

  it('ne dégrade pas si entretenue aujourd\'hui (joursSans < 1)', () => {
    const score = calculerNouveauScore(100, 10, 0)
    expect(score).toBe(100)
  })

  it('passe à "urgent" quand score < 20', () => {
    expect(calculerEtatGeneral(15)).toBe('urgent')
    expect(calculerEtatGeneral(0)).toBe('urgent')
  })

  it('passe à "tres_propre" quand score >= 80', () => {
    expect(calculerEtatGeneral(80)).toBe('tres_propre')
    expect(calculerEtatGeneral(100)).toBe('tres_propre')
  })

  it('la salle de bain (taux=8) passe urgent en ~10 jours sans entretien', () => {
    let score = 80
    for (let jour = 0; jour < 10; jour++) {
      score = calculerNouveauScore(score, 8, 1)
    }
    expect(score).toBeLessThan(20)
  })
})
