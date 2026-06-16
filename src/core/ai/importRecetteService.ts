/**
 * FAMILY OS — Service IA Import Recettes
 *
 * Trois modes d'entrée :
 *   1. texte_libre  → contenu collé (page web, blog, texte quelconque)
 *   2. url          → URL fournie en contexte + texte collé par l'utilisateur
 *   3. screenshot   → image base64 (screenshot Instagram / TikTok / Pinterest)
 *
 * Note architecture : l'app est locale-first sans backend.
 * Le fetch direct d'une URL tiers est bloqué par CORS.
 * Pour le mode URL, le parent colle le texte de la page — l'URL est conservée
 * comme métadonnée source uniquement.
 * L'analyse vidéo (TikTok) est prévue dans l'architecture mais non implémentée (MVP).
 */

import { appelOpenAI, appelOpenAIVision } from './openaiService'
import type { RecetteExtractee, IngredientExtrait, DifficulteActivite } from '../../shared/types'

// ─── Prompt extraction texte ──────────────────────────────────────────────────

function buildPromptExtraction(contenu: string, sourceUrl?: string): string {
  return `Tu es un assistant spécialisé dans l'extraction de recettes de cuisine.
Analyse le contenu suivant et extrais toutes les informations de la recette.
${sourceUrl ? `Source originale : ${sourceUrl}` : ''}

CONTENU :
${contenu.slice(0, 12000)}

RÈGLES D'EXTRACTION :
- Si une information est absente du contenu, ne l'inclus pas dans le JSON (pas de valeur null ou "")
- Convertis toutes les quantités en unités standards : g, kg, ml, cl, L, pièces, c. à soupe, c. à café
- Les étapes doivent être des phrases complètes, autonomes et actionnables
- Normalise les unités en français (tablespoon → c. à soupe, cup → 25 cl, oz → g)
- difficulte : "facile" si < 30 min et peu d'étapes, "difficile" si technique ou > 1h, sinon "moyen"
- confidenceScore : 0.0–1.0 (1.0 = recette claire et complète, 0.3 = informations partielles)
- Si le contenu ne contient pas de recette, retourne {"erreur": "Aucune recette détectée"}

FORMAT JSON ATTENDU (sans markdown, sans backticks) :
{
  "nom": "Nom de la recette",
  "tempsPreparation": 15,
  "tempsCuisson": 30,
  "portions": 4,
  "difficulte": "facile",
  "ingredients": [
    {"nom": "farine", "quantite": 200, "unite": "g", "optionnel": false},
    {"nom": "sucre vanillé", "quantite": 1, "unite": "sachet", "optionnel": true}
  ],
  "etapes": [
    "Préchauffer le four à 180°C (th. 6).",
    "Dans un saladier, mélanger la farine et le sucre.",
    "Incorporer les œufs un à un en remuant vigoureusement."
  ],
  "tags": ["végétarien", "sans gluten", "rapide", "enfants"],
  "sourceOriginale": "${sourceUrl ?? 'collé manuellement'}",
  "confidenceScore": 0.9
}`
}

// ─── Prompt extraction image ──────────────────────────────────────────────────

function buildPromptVision(sourceUrl?: string): string {
  return `Tu es un assistant spécialisé dans l'extraction de recettes de cuisine depuis des images.
Analyse cette image (screenshot de réseaux sociaux, blog, capture d'écran) et extrais toutes les informations de recette visibles.
${sourceUrl ? `Source : ${sourceUrl}` : ''}

RÈGLES :
- Extrais tout ce qui est visible : ingrédients, étapes, temps, portions
- Si des informations sont partiellement visibles ou découpées, déduis-les intelligemment
- difficulte : "facile" / "moyen" / "difficile" selon la complexité observée
- confidenceScore bas (0.3–0.5) si beaucoup d'informations manquantes
- Si l'image ne contient pas de recette : {"erreur": "Aucune recette détectée dans l'image"}

FORMAT JSON ATTENDU :
{
  "nom": "Nom de la recette",
  "tempsPreparation": 15,
  "tempsCuisson": 30,
  "portions": 4,
  "difficulte": "moyen",
  "ingredients": [
    {"nom": "beurre", "quantite": 100, "unite": "g", "optionnel": false}
  ],
  "etapes": ["Étape 1 complète.", "Étape 2 complète."],
  "tags": ["tag1", "tag2"],
  "sourceOriginale": "${sourceUrl ?? 'image'}",
  "confidenceScore": 0.7
}`
}

// ─── Parser + validation ──────────────────────────────────────────────────────

function nettoyerJSON(raw: string): string {
  return raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

interface ExtractedRaw {
  erreur?: string
  nom?: string
  tempsPreparation?: number
  tempsCuisson?: number
  portions?: number
  difficulte?: string
  ingredients?: RawIngredient[]
  etapes?: string[]
  tags?: string[]
  sourceOriginale?: string
  confidenceScore?: number
}

const DIFFICULTES_VALIDES: DifficulteActivite[] = ['facile', 'moyen', 'difficile']

function validerIngredient(raw: RawIngredient): IngredientExtrait | null {
  if (!raw.nom?.trim()) return null
  return {
    nom:       raw.nom.trim(),
    quantite:  typeof raw.quantite === 'number' ? raw.quantite : undefined,
    unite:     raw.unite?.trim(),
    optionnel: raw.optionnel === true,
  }
}

function validerExtraction(raw: ExtractedRaw, sourceUrl?: string): RecetteExtractee {
  const ingredients: IngredientExtrait[] = (raw.ingredients ?? [])
    .map(validerIngredient)
    .filter((i): i is IngredientExtrait => i !== null)

  const etapes = (raw.etapes ?? []).filter(e => typeof e === 'string' && e.trim().length > 0)

  const difficulte = DIFFICULTES_VALIDES.includes(raw.difficulte as DifficulteActivite)
    ? (raw.difficulte as DifficulteActivite)
    : undefined

  return {
    nom:              raw.nom?.trim() ?? 'Recette importée',
    tempsPreparation: typeof raw.tempsPreparation === 'number' ? raw.tempsPreparation : undefined,
    tempsCuisson:     typeof raw.tempsCuisson === 'number' ? raw.tempsCuisson : undefined,
    portions:         typeof raw.portions === 'number' ? raw.portions : undefined,
    difficulte,
    ingredients,
    etapes,
    tags:             Array.isArray(raw.tags) ? raw.tags.filter(t => typeof t === 'string') : [],
    sourceOriginale:  raw.sourceOriginale ?? sourceUrl ?? '',
    confidenceScore:  typeof raw.confidenceScore === 'number'
                        ? Math.min(1, Math.max(0, raw.confidenceScore))
                        : 0.5,
  }
}

// ─── Correspondance ingrédients → produits catalogue ─────────────────────────

import { db } from '../db/database'

type RawIngredient = { nom?: string; quantite?: number; unite?: string; optionnel?: boolean }

function normaliser(s: string): string {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

export async function matcherIngredientsProduits(
  ingredients: IngredientExtrait[],
): Promise<IngredientExtrait[]> {
  const produits = await db.produits.filter(p => !p.archive).toArray()

  return ingredients.map(ing => {
    const cible = normaliser(ing.nom)
    const match = produits.find(p => {
      const nom = normaliser(p.nomNormalise ?? p.nom)
      return nom === cible || nom.includes(cible) || cible.includes(nom)
    })
    return match ? { ...ing, produitMatchId: match.id } : ing
  })
}

// ─── Extraction depuis texte / URL ────────────────────────────────────────────

export async function extraireRecetteDepuisTexte(
  texte: string,
  sourceUrl?: string,
): Promise<RecetteExtractee> {
  if (!texte.trim()) throw new Error('Contenu vide')

  const prompt = buildPromptExtraction(texte, sourceUrl)
  const raw = await appelOpenAI(prompt, {
    model:       'gpt-4o-mini',
    temperature: 0.2,
    maxTokens:   2048,
    jsonMode:    true,
  })

  const parsed = JSON.parse(nettoyerJSON(raw)) as ExtractedRaw
  if (parsed.erreur) throw new Error(parsed.erreur)

  const recette = validerExtraction(parsed, sourceUrl)
  recette.ingredients = await matcherIngredientsProduits(recette.ingredients)
  return recette
}

// ─── Extraction depuis image (screenshot) ─────────────────────────────────────

export async function extraireRecetteDepuisImage(
  imageBase64: string,
  sourceUrl?: string,
): Promise<RecetteExtractee> {
  const prompt = buildPromptVision(sourceUrl)
  const raw = await appelOpenAIVision(imageBase64, prompt, {
    maxTokens: 2048,
    jsonMode:  true,
  })

  const parsed = JSON.parse(nettoyerJSON(raw)) as ExtractedRaw
  if (parsed.erreur) throw new Error(parsed.erreur)

  const recette = validerExtraction(parsed, sourceUrl)
  recette.ingredients = await matcherIngredientsProduits(recette.ingredients)
  return recette
}
