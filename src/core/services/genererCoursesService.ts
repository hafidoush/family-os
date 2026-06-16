/**
 * FAMILY OS — genererCoursesService
 *
 * Génère la liste de courses à partir des menus actifs (déterministe, sans IA).
 *
 * Logique :
 *  1. Récupère les MenuSlots de la semaine en cours (ou du menuId fourni)
 *  2. Pour chaque slot avec une recette, charge les RecetteIngredients
 *  3. Résout chaque ingrédient vers un Produit ou crée une entrée libre
 *  4. Dédoublonne par produit (additionne les quantités)
 *  5. Exclut les articles déjà cochés ou déjà présents dans la liste
 *  6. Crée les CoursesItems manquants
 */

import { db } from '../db/database'
import { newEntity } from '../db/helpers'
import type { CoursesItem } from '../../shared/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISO(d: Date): string { return d.toISOString().split('T')[0] }

function getLundiSemaine(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  return r
}

// ─── Types internes ───────────────────────────────────────────────────────────

interface ArticleAjouter {
  produitId?: string     // si résolu en Produit
  nom: string            // nom libre si pas de produit
  quantite?: number
  unite?: string
  menuId: string
  recetteId?: string
  categorieProduitId?: string
}

// ─── Résolution produit ───────────────────────────────────────────────────────

function normaliser(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

async function trouverProduitId(nom: string): Promise<string | undefined> {
  const produits = await db.produits.filter(p => !p.deletedAt).toArray()
  const cible = normaliser(nom)
  const exact  = produits.find(p => normaliser(p.nom) === cible)
  if (exact) return exact.id
  const partiel = produits.find(p => normaliser(p.nom).includes(cible) || cible.includes(normaliser(p.nom)))
  return partiel?.id
}

// ─── Fonction principale ──────────────────────────────────────────────────────

export interface ResultatCourses {
  articlesAjoutés: number
  articlesExistants: number
  message: string
}

export async function genererCoursesDepuisMenus(menuId?: string): Promise<ResultatCourses> {
  // 1. Trouver le ou les menus à traiter
  let menuIds: string[] = []

  if (menuId) {
    menuIds = [menuId]
  } else {
    // Menu actif cette semaine
    const lundi  = getLundiSemaine(new Date())
    const lundi7 = new Date(lundi); lundi7.setDate(lundi.getDate() + 6)
    const menus  = await db.menus
      .filter(m => !m.deletedAt && !m.archive && !!m.dateDebut)
      .toArray()
    const actifs = menus.filter(m =>
      m.dateDebut >= toISO(lundi) && m.dateDebut <= toISO(lundi7)
    )
    menuIds = actifs.map(m => m.id)
  }

  if (menuIds.length === 0) {
    return { articlesAjoutés: 0, articlesExistants: 0, message: 'Aucun menu actif trouvé' }
  }

  // 2. Récupérer les slots avec recettes
  const allSlots = await db.menuSlots
    .filter(s => menuIds.includes(s.menu) && !s.archive && !!s.recette)
    .toArray()

  if (allSlots.length === 0) {
    return { articlesAjoutés: 0, articlesExistants: 0, message: 'Aucune recette dans les menus — ajoutez des recettes pour générer la liste' }
  }

  // 3. Charger les ingrédients de chaque recette
  const articlesMap = new Map<string, ArticleAjouter>() // clé = produitId ou nom normalisé

  for (const slot of allSlots) {
    if (!slot.recette) continue
    const ingredients = await db.recettesIngredients
      .filter(i => i.recette === slot.recette)
      .toArray()

    for (const ing of ingredients) {
      // Résoudre le produit
      const produit = await db.produits.get(ing.produit).catch(() => undefined)
      const nom = produit?.nom ?? `Ingrédient recette ${slot.recette}`
      const cle = produit?.id ?? normaliser(nom)

      if (articlesMap.has(cle)) {
        // Cumuler les quantités si même unité
        const existing = articlesMap.get(cle)!
        if (existing.unite === ing.unite && ing.quantite) {
          existing.quantite = (existing.quantite ?? 0) + ing.quantite
        }
      } else {
        articlesMap.set(cle, {
          produitId:         produit?.id,
          nom,
          quantite:          ing.quantite,
          unite:             ing.unite,
          menuId:            slot.menu,
          recetteId:         slot.recette,
          categorieProduitId: produit?.categorie,
        })
      }
    }
  }

  if (articlesMap.size === 0) {
    return { articlesAjoutés: 0, articlesExistants: 0, message: 'Les recettes n\'ont pas d\'ingrédients renseignés' }
  }

  // 4. Charger la liste de courses existante (non cochée)
  const coursesExistantes = await db.coursesItems
    .filter(c => !c.deletedAt && !c.coche)
    .toArray()

  const existingKeys = new Set(
    coursesExistantes.map(c => c.produit || normaliser(c.nom ?? ''))
  )

  // 5. Créer les articles manquants
  let ajoutés = 0
  let existants = 0

  for (const [cle, article] of articlesMap) {
    if (existingKeys.has(cle)) { existants++; continue }

    // Résoudre le produitId si pas encore fait
    const produitId = article.produitId ?? await trouverProduitId(article.nom)

    await db.coursesItems.add(newEntity<CoursesItem>({
      produit:           produitId ?? '',
      nom:               article.nom,
      quantite:          article.quantite,
      unite:             article.unite,
      coche:             false,
      source:            'menu',
      dateAjout:         new Date(),
      menuId:            article.menuId,
      recetteId:         article.recetteId,
      categorieProduitId: article.categorieProduitId,
    }))
    ajoutés++
  }

  return {
    articlesAjoutés: ajoutés,
    articlesExistants: existants,
    message: ajoutés > 0
      ? `${ajoutés} article${ajoutés > 1 ? 's' : ''} ajouté${ajoutés > 1 ? 's' : ''} à votre liste${existants > 0 ? ` · ${existants} déjà présents` : ''}`
      : `Tous les articles sont déjà dans votre liste`,
  }
}
