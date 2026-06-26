/**
 * FAMILY OS — Service de génération de fiche activité complète
 * Appelle Claude Haiku pour générer tous les champs à partir du nom.
 */

import { appelClaude } from './claudeService'

export interface FicheActiviteResult {
  objectifPedagogique: string
  materiel: string           // une ligne par item, séparées par \n
  instructions: string
  preparationTexte: string
  preparationDelaiJours: number
  preparationUrgence: 'immediate' | 'veille' | 'plusieurs_jours'
  dureeEstimee: number
  ageMin: number
  ageMax: number
  difficulte: 'Facile' | 'Moyen' | 'Difficile'
}

function buildPrompt(nom: string): string {
  return `Tu es un assistant spécialisé en activités Montessori pour enfants de 2 à 5 ans.
À partir du nom de l'activité : "${nom}"

Génère une fiche complète en JSON strict, sans markdown, sans texte avant ou après :
{
  "objectifPedagogique": "...",
  "materiel": "item1\\nitem2\\nitem3",
  "instructions": "1. Étape...\\n2. Étape...\\n3. Étape...",
  "preparationTexte": "...",
  "preparationDelaiJours": 0,
  "preparationUrgence": "immediate",
  "dureeEstimee": 20,
  "ageMin": 24,
  "ageMax": 60,
  "difficulte": "Facile"
}

Règles :
- materiel : un élément par ligne, sans tirets ni puces
- instructions : numérotées, une étape par ligne
- difficulte : exactement "Facile", "Moyen" ou "Difficile"
- preparationDelaiJours : 0 si rien à préparer en amont, 1 si la veille, 3 si plusieurs jours avant
- preparationUrgence : "immediate", "veille" ou "plusieurs_jours"
- ageMin et ageMax en mois`
}

const VALID_URGENCE = ['immediate', 'veille', 'plusieurs_jours']
const VALID_DIFF    = ['Facile', 'Moyen', 'Difficile']

export async function genererFicheActivite(nom: string): Promise<FicheActiviteResult> {
  const raw   = await appelClaude(buildPrompt(nom), { maxTokens: 1024, temperature: 0 })
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let parsed: Partial<FicheActiviteResult>
  try {
    parsed = JSON.parse(clean)
  } catch {
    parsed = {}
  }

  return {
    objectifPedagogique:   typeof parsed.objectifPedagogique === 'string'  ? parsed.objectifPedagogique  : '',
    materiel:              typeof parsed.materiel             === 'string'  ? parsed.materiel             : '',
    instructions:          typeof parsed.instructions         === 'string'  ? parsed.instructions         : '',
    preparationTexte:      typeof parsed.preparationTexte     === 'string'  ? parsed.preparationTexte     : '',
    preparationDelaiJours: Number.isFinite(parsed.preparationDelaiJours)    ? parsed.preparationDelaiJours! : 0,
    preparationUrgence:    VALID_URGENCE.includes(parsed.preparationUrgence as string)
                             ? parsed.preparationUrgence as FicheActiviteResult['preparationUrgence']
                             : 'immediate',
    dureeEstimee:          Number.isFinite(parsed.dureeEstimee)             ? parsed.dureeEstimee!        : 20,
    ageMin:                Number.isFinite(parsed.ageMin)                   ? parsed.ageMin!              : 24,
    ageMax:                Number.isFinite(parsed.ageMax)                   ? parsed.ageMax!              : 60,
    difficulte:            VALID_DIFF.includes(parsed.difficulte as string)
                             ? parsed.difficulte as FicheActiviteResult['difficulte']
                             : 'Facile',
  }
}
