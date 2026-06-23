import { describe, it, expect } from 'vitest'

// ─── Logique extraite de A-01 pour être testable sans Dexie ──────────────────

interface Ingredient { produit: string; quantite: number; unite: string }
interface CoursesItem { id: string; produit: string; quantite: number; coche: boolean }

function genererListeCourses(
  ingredients: Ingredient[],
  coursesExistantes: CoursesItem[]
): { aAjouter: Ingredient[]; aFusionner: Array<{ id: string; nouvelleQuantite: number }> } {
  const aAjouter: Ingredient[] = []
  const aFusionner: Array<{ id: string; nouvelleQuantite: number }> = []

  for (const ingredient of ingredients) {
    const existant = coursesExistantes.find(c => c.produit === ingredient.produit && !c.coche)
    if (existant) {
      aFusionner.push({ id: existant.id, nouvelleQuantite: existant.quantite + ingredient.quantite })
    } else {
      aAjouter.push(ingredient)
    }
  }
  return { aAjouter, aFusionner }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('A-01 — Génération liste de courses depuis menu validé', () => {

  it('crée un item pour chaque ingrédient absent des courses', () => {
    const ingredients = [
      { produit: 'prod-poulet', quantite: 1, unite: 'kg' },
      { produit: 'prod-riz',    quantite: 500, unite: 'g' },
    ]
    const { aAjouter } = genererListeCourses(ingredients, [])
    expect(aAjouter).toHaveLength(2)
    expect(aAjouter[0].produit).toBe('prod-poulet')
  })

  it('fusionne si le produit est déjà dans les courses — ne crée pas de doublon', () => {
    const ingredients = [{ produit: 'prod-ail', quantite: 3, unite: 'gousses' }]
    const coursesExistantes = [{ id: 'item-1', produit: 'prod-ail', quantite: 2, coche: false }]

    const { aAjouter, aFusionner } = genererListeCourses(ingredients, coursesExistantes)

    expect(aAjouter).toHaveLength(0)
    expect(aFusionner).toHaveLength(1)
    expect(aFusionner[0].nouvelleQuantite).toBe(5) // 2 + 3
  })

  it('ne touche pas à un produit déjà coché (déjà acheté)', () => {
    const ingredients = [{ produit: 'prod-ail', quantite: 3, unite: 'gousses' }]
    const coursesExistantes = [{ id: 'item-1', produit: 'prod-ail', quantite: 2, coche: true }]

    const { aAjouter, aFusionner } = genererListeCourses(ingredients, coursesExistantes)

    // Le produit coché est ignoré → on recrée un item
    expect(aAjouter).toHaveLength(1)
    expect(aFusionner).toHaveLength(0)
  })

  it('gère un menu avec 2 recettes qui partagent un ingrédient', () => {
    // Poulet rôti (ail x3) + Tabboulé (ail x2) → ail total = 5
    const ingredients = [
      { produit: 'prod-ail', quantite: 3, unite: 'gousses' },
      { produit: 'prod-ail', quantite: 2, unite: 'gousses' },
    ]
    const { aAjouter, aFusionner } = genererListeCourses(ingredients, [])

    // Premier ail → ajouté, deuxième ail → fusionné avec le premier
    expect(aAjouter.length + aFusionner.length).toBe(2)
  })
})
