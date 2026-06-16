/**
 * FAMILY OS — Service CRUD Import Recettes IA
 *
 * Orchestre le workflow complet :
 *   1. Créer un enregistrement ImportRecetteIA (statut: en_attente)
 *   2. Déclencher l'extraction IA (statut: extraction → a_valider)
 *   3. Le parent valide / corrige dans l'UI
 *   4. Sauvegarder la Recette + ingrédients définitifs (statut: valide)
 */

import { db } from '../../../core/db/database'
import { newEntity, withUpdate, softDeleteFields } from '../../../core/db/helpers'
import { createRecette } from './recetteService'
import { emit } from '../../../core/automation/engine'
import {
  extraireRecetteDepuisTexte,
  extraireRecetteDepuisImage,
} from '../../../core/ai/importRecetteService'
import type {
  ImportRecetteIA,
  RecetteExtractee,
  IngredientExtrait,
  SourceTypeImportRecette,
} from '../../../shared/types'

// ─── Types formulaire de validation ──────────────────────────────────────────

export interface RecetteValideeFormData {
  nom: string
  tempsPreparation?: number
  tempsCuisson?: number
  portions?: number
  difficulte?: 'facile' | 'moyen' | 'difficile'
  categorieId: string
  etapes: string[]
  tags?: string[]
  ingredients: IngredientValideFormData[]
  imageData?: string
}

export interface IngredientValideFormData {
  produitId?: string       // Produit.id — si lié au catalogue
  nomLibre: string         // toujours rempli (fallback si pas de produitId)
  quantite?: number
  unite?: string
  optionnel: boolean
}

// ─── Initialiser un import ────────────────────────────────────────────────────

export async function initierImport(
  sourceType: SourceTypeImportRecette,
  opts: { sourceUrl?: string; sourceTexte?: string; sourceImageData?: string },
): Promise<string> {
  const entry = newEntity<ImportRecetteIA>({
    sourceType,
    sourceUrl:       opts.sourceUrl,
    sourceTexte:     opts.sourceTexte,
    sourceImageData: opts.sourceImageData,
    statut:          'en_attente',
    archive:         false,
  })
  await db.importsRecettesIA.add(entry)
  return entry.id
}

// ─── Déclencher l'extraction IA ───────────────────────────────────────────────

export async function extraireIA(importId: string): Promise<RecetteExtractee> {
  const entry = await db.importsRecettesIA.get(importId)
  if (!entry) throw new Error(`Import ${importId} introuvable`)

  await db.importsRecettesIA.update(importId, withUpdate({ statut: 'extraction' }))

  try {
    let recette: RecetteExtractee

    if (entry.sourceType === 'screenshot' && entry.sourceImageData) {
      recette = await extraireRecetteDepuisImage(entry.sourceImageData, entry.sourceUrl)
    } else {
      // texte_libre ou url (texte collé par l'utilisateur)
      const texte = entry.sourceTexte ?? ''
      recette = await extraireRecetteDepuisTexte(texte, entry.sourceUrl)
    }

    await db.importsRecettesIA.update(importId, withUpdate({
      statut:           'a_valider',
      recetteExtractee: recette,
    }))

    return recette
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    await db.importsRecettesIA.update(importId, withUpdate({
      statut: 'erreur',
      erreur: message,
    }))
    throw err
  }
}

// ─── Valider et sauvegarder la recette ───────────────────────────────────────

export async function validerEtSauvegarder(
  importId: string,
  data: RecetteValideeFormData,
): Promise<string> {
  const entry = await db.importsRecettesIA.get(importId)
  if (!entry) throw new Error(`Import ${importId} introuvable`)

  // Construire les ingredients pour createRecette
  // Les ingrédients sans produitId sont ignorés (pas de produit catalogue associé)
  // On crée d'abord les produits manquants si besoin — pour MVP on passe les liés uniquement
  const ingredientsLies = data.ingredients
    .filter(i => i.produitId)
    .map(i => ({
      produit:  i.produitId!,
      quantite: i.quantite ?? 1,
      unite:    i.unite,
      optionnel: i.optionnel,
    }))

  const recetteId = await createRecette(
    {
      nom:              data.nom,
      categorie:        data.categorieId,
      difficulte:       data.difficulte,
      tempsPreparation: data.tempsPreparation,
      tempsCuisson:     data.tempsCuisson,
      portions:         data.portions,
      etapes:           data.etapes,
      tags:             data.tags,
      imageData:        data.imageData,
    },
    ingredientsLies,
  )

  await db.importsRecettesIA.update(importId, withUpdate({
    statut:    'valide',
    recetteId,
  }))

  // Compter les ingrédients sans correspondance catalogue pour A-46
  const nbManquants = data.ingredients.filter(i => !i.produitId).length
  await emit('import_recette.validated', {
    recetteId,
    recetteTitre: data.nom,
    nbIngredientsManquants: nbManquants,
  }, 'cuisine')

  return recetteId
}

// ─── Réessayer un import en erreur ───────────────────────────────────────────

export async function reessayerImport(importId: string): Promise<RecetteExtractee> {
  await db.importsRecettesIA.update(importId, withUpdate({
    statut: 'en_attente',
    erreur: undefined,
    recetteExtractee: undefined,
  }))
  return extraireIA(importId)
}

// ─── Archiver ────────────────────────────────────────────────────────────────

export async function archiverImport(importId: string): Promise<void> {
  await db.importsRecettesIA.update(importId, softDeleteFields())
}

// ─── Créer depuis URL (raccourci) ────────────────────────────────────────────

export async function importerDepuisURL(
  url: string,
  texteColle: string,
): Promise<{ importId: string; recette: RecetteExtractee }> {
  const importId = await initierImport('url', { sourceUrl: url, sourceTexte: texteColle })
  const recette = await extraireIA(importId)
  return { importId, recette }
}

// ─── Créer depuis texte libre (raccourci) ────────────────────────────────────

export async function importerDepuisTexte(
  texte: string,
): Promise<{ importId: string; recette: RecetteExtractee }> {
  const importId = await initierImport('texte_libre', { sourceTexte: texte })
  const recette = await extraireIA(importId)
  return { importId, recette }
}

// ─── Créer depuis image (raccourci) ──────────────────────────────────────────

export async function importerDepuisImage(
  imageBase64: string,
  sourceUrl?: string,
): Promise<{ importId: string; recette: RecetteExtractee }> {
  const importId = await initierImport('screenshot', { sourceImageData: imageBase64, sourceUrl })
  const recette = await extraireIA(importId)
  return { importId, recette }
}

// ─── Hook-friendly : charger l'historique des imports ────────────────────────

export { db }
