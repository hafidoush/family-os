import { db } from '../../../core/db/database'
import { newEntity, withUpdate } from '../../../core/db/helpers'
import { v4 as uuid } from 'uuid'
import type {
  EvenementDetail, EvenementMenuItem, EvenementCoursesItem,
  ChecklistItem,
} from '../../../shared/types'
import { CoursesService } from '../../cuisine/services/CoursesService'

// ─── Lecture ──────────────────────────────────────────────────────────────────

export async function getDetail(evenementId: string): Promise<EvenementDetail | undefined> {
  return db.evenementsDetails.get(evenementId)
}

// ─── Création / mise à jour ───────────────────────────────────────────────────

export async function upsertDetail(
  evenementId: string,
  patch: Partial<Omit<EvenementDetail, 'id' | 'evenementId' | 'createdAt' | 'updatedAt' | 'deviceId'>>,
): Promise<void> {
  const existing = await db.evenementsDetails.get(evenementId)
  if (existing) {
    await db.evenementsDetails.update(evenementId, withUpdate(patch))
  } else {
    const detail = newEntity<EvenementDetail>({
      evenementId,
      archive: false,
      ...patch,
    })
    // On force l'id = evenementId pour un accès direct par PK
    await db.evenementsDetails.put({ ...detail, id: evenementId })
  }
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export async function addMenuItem(
  evenementId: string,
  item: Omit<EvenementMenuItem, 'id'>,
): Promise<void> {
  const detail = await getDetail(evenementId)
  const items = detail?.menuItems ?? []
  await upsertDetail(evenementId, {
    menuItems: [...items, { ...item, id: uuid() }],
  })
}

export async function removeMenuItem(evenementId: string, itemId: string): Promise<void> {
  const detail = await getDetail(evenementId)
  await upsertDetail(evenementId, {
    menuItems: (detail?.menuItems ?? []).filter(i => i.id !== itemId),
  })
}

// ─── Courses ─────────────────────────────────────────────────────────────────

export async function genererCoursesDepuisRecettes(evenementId: string): Promise<void> {
  const detail = await getDetail(evenementId)
  const recetteIds = (detail?.menuItems ?? [])
    .filter(i => i.recetteId)
    .map(i => i.recetteId!)

  if (recetteIds.length === 0) return

  // Charger tous les ingrédients des recettes sélectionnées
  const ingredients = await db.recettesIngredients
    .filter(ri => recetteIds.includes(ri.recette))
    .toArray()

  // Charger les produits associés
  const produitIds = [...new Set(ingredients.map(i => i.produit))]
  const produits = await db.produits
    .where('id').anyOf(produitIds).toArray()
  const produitMap = Object.fromEntries(produits.map(p => [p.id, p]))

  // Construire les items de courses en dédupliquant sur produitId
  const existing = detail?.coursesItems ?? []
  const newItems: EvenementCoursesItem[] = []

  for (const ing of ingredients) {
    const produit = produitMap[ing.produit]
    const label = produit?.nom ?? ing.produit
    const alreadyInEvent = existing.find(e => e.produitId === ing.produit || e.label.toLowerCase() === label.toLowerCase())
    if (!alreadyInEvent) {
      newItems.push({
        id: uuid(),
        label,
        quantite: ing.quantite,
        unite: ing.unite,
        coche: false,
        produitId: ing.produit,
      })
    }
  }

  await upsertDetail(evenementId, {
    coursesItems: [...existing, ...newItems],
  })
}

export async function toggleCourseItem(evenementId: string, itemId: string): Promise<void> {
  const detail = await getDetail(evenementId)
  await upsertDetail(evenementId, {
    coursesItems: (detail?.coursesItems ?? []).map(i =>
      i.id === itemId ? { ...i, coche: !i.coche } : i
    ),
  })
}

export async function updateCourseItem(
  evenementId: string,
  itemId: string,
  patch: Partial<EvenementCoursesItem>,
): Promise<void> {
  const detail = await getDetail(evenementId)
  await upsertDetail(evenementId, {
    coursesItems: (detail?.coursesItems ?? []).map(i =>
      i.id === itemId ? { ...i, ...patch } : i
    ),
  })
}

export async function removeCourseItem(evenementId: string, itemId: string): Promise<void> {
  const detail = await getDetail(evenementId)
  await upsertDetail(evenementId, {
    coursesItems: (detail?.coursesItems ?? []).filter(i => i.id !== itemId),
  })
}

export async function addCourseItem(evenementId: string, label: string): Promise<void> {
  const detail = await getDetail(evenementId)
  const items = detail?.coursesItems ?? []
  await upsertDetail(evenementId, {
    coursesItems: [...items, { id: uuid(), label, coche: false }],
  })
}

/** Envoie les items non cochés vers la liste de courses principale */
export async function ajouterAuxCoursesPrincipales(evenementId: string): Promise<number> {
  const detail = await getDetail(evenementId)
  const items = (detail?.coursesItems ?? []).filter(i => !i.coche)
  let ajoutees = 0
  for (const item of items) {
    await CoursesService.addItem({
      produitId: item.produitId,
      nom: item.label,
      quantite: item.quantite,
      unite: item.unite,
    })
    ajoutees++
  }
  return ajoutees
}

// ─── Checklists ───────────────────────────────────────────────────────────────

type ChecklistKey = 'checklistPrep' | 'checklistDeco'

export async function addChecklistItem(
  evenementId: string,
  key: ChecklistKey,
  label: string,
): Promise<void> {
  const detail = await getDetail(evenementId)
  const items: ChecklistItem[] = detail?.[key] ?? []
  await upsertDetail(evenementId, {
    [key]: [...items, { id: uuid(), label, coche: false }],
  })
}

export async function toggleChecklistItem(
  evenementId: string,
  key: ChecklistKey,
  itemId: string,
): Promise<void> {
  const detail = await getDetail(evenementId)
  await upsertDetail(evenementId, {
    [key]: (detail?.[key] ?? []).map((i: ChecklistItem) =>
      i.id === itemId ? { ...i, coche: !i.coche } : i
    ),
  })
}

export async function removeChecklistItem(
  evenementId: string,
  key: ChecklistKey,
  itemId: string,
): Promise<void> {
  const detail = await getDetail(evenementId)
  await upsertDetail(evenementId, {
    [key]: (detail?.[key] ?? []).filter((i: ChecklistItem) => i.id !== itemId),
  })
}
