/**
 * FAMILY OS — genererMenusService
 *
 * Génère une semaine de repas (déjeuner + dîner) via Gemini,
 * puis crée les MenuSlots correspondants dans Dexie.
 *
 * Stratégie :
 *  1. Charge les recettes existantes pour les suggérer à Gemini.
 *  2. Gemini retourne un plan JSON structuré (7 jours × 2 repas).
 *  3. Pour chaque repas, on cherche une recette correspondante en DB.
 *     Si trouvée → slot avec recette.id. Sinon → slot en descriptionLibre.
 */

import { db } from '../db/database'
import { newEntity } from '../db/helpers'
import { appelOpenAI } from './openaiService'
import type { MenuSlot, JourMenu, TypeRepas } from '../../shared/types'

const JOURS: JourMenu[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

// ─── Types réponse Gemini ─────────────────────────────────────────────────────

interface RepasIA {
  dejeuner: string
  diner: string
}

type PlanSemaineIA = Record<JourMenu, RepasIA>

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPromptMenus(recettesExistantes: string[], nbPersonnes: number): string {
  const recettesSection = recettesExistantes.length > 0
    ? `\nRecettes disponibles dans l'application (privilégie-les si pertinentes) :\n${recettesExistantes.slice(0, 40).map(r => `- ${r}`).join('\n')}`
    : ''

  return `Tu es un assistant culinaire pour une famille française. Génère un plan de repas équilibré pour une semaine complète (déjeuner + dîner) pour ${nbPersonnes} personne${nbPersonnes > 1 ? 's' : ''}.

Contraintes :
- Repas variés (pas deux fois la même viande consécutive)
- Équilibre protéines / légumes / féculents
- Noms de plats simples et réalistes en français
- Le week-end : repas un peu plus festifs ou en famille${recettesSection}

Retourne UNIQUEMENT un objet JSON valide sans markdown, sans backticks, sans commentaires.

Format attendu :
{
  "lundi":    { "dejeuner": "nom du plat", "diner": "nom du plat" },
  "mardi":    { "dejeuner": "...", "diner": "..." },
  "mercredi": { "dejeuner": "...", "diner": "..." },
  "jeudi":    { "dejeuner": "...", "diner": "..." },
  "vendredi": { "dejeuner": "...", "diner": "..." },
  "samedi":   { "dejeuner": "...", "diner": "..." },
  "dimanche": { "dejeuner": "...", "diner": "..." }
}`
}

// ─── Appel OpenAI ─────────────────────────────────────────────────────────────

async function appelOpenAIMenus(prompt: string): Promise<PlanSemaineIA> {
  const raw = await appelOpenAI(prompt, 0.7)
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const match   = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Réponse OpenAI invalide')
  return JSON.parse(match[0]) as PlanSemaineIA
}

// ─── Résolution recette ───────────────────────────────────────────────────────

function normaliser(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

async function trouverRecetteId(nomPlat: string): Promise<string | undefined> {
  const recettes = await db.recettes.filter(r => !r.archive).toArray()
  const cible = normaliser(nomPlat)

  // Correspondance exacte
  const exacte = recettes.find(r => normaliser(r.nom) === cible)
  if (exacte) return exacte.id

  // Correspondance partielle (le nom du plat contient le nom de la recette ou vice-versa)
  const partielle = recettes.find(r => {
    const n = normaliser(r.nom)
    return cible.includes(n) || n.includes(cible)
  })
  return partielle?.id
}

// ─── Fonction principale ──────────────────────────────────────────────────────

export interface ResultatGeneration {
  slotsCreés: number
  recettesMatchées: number
  message: string
}

export async function genererMenusIA(
  menuId: string,
  nbPersonnes = 4,
  assignerJours = true,
): Promise<ResultatGeneration> {
  // 1. Charger les recettes existantes pour le prompt
  const recettes = await db.recettes.filter(r => !r.archive).toArray()
  const nomsRecettes = recettes.map(r => r.nom)

  // 2. Appel OpenAI
  const plan = await appelOpenAIMenus(buildPromptMenus(nomsRecettes, nbPersonnes))

  // 3. Supprimer les slots existants du menu
  const slotsExistants = await db.menuSlots.filter(s => s.menu === menuId && !s.archive).toArray()
  await Promise.all(slotsExistants.map(s => db.menuSlots.delete(s.id)))

  // 4. Créer les nouveaux slots
  let slotsCreés = 0
  let recettesMatchées = 0

  const repasTypes: { key: 'dejeuner' | 'diner'; type: TypeRepas }[] = [
    { key: 'dejeuner', type: 'dejeuner' },
    { key: 'diner',    type: 'diner' },
  ]

  for (const jour of JOURS) {
    const jourPlan = plan[jour]
    if (!jourPlan) continue

    for (const { key, type } of repasTypes) {
      const nomPlat = jourPlan[key]
      if (!nomPlat) continue

      const recetteId = await trouverRecetteId(nomPlat)
      if (recetteId) recettesMatchées++

      await db.menuSlots.add(newEntity<MenuSlot>({
        menu:             menuId,
        jour:             assignerJours ? jour : undefined,
        repas:            type,
        recette:          recetteId,
        descriptionLibre: recetteId ? undefined : nomPlat,
        statut:           'prevue',
        archive:          false,
      }))
      slotsCreés++
    }
  }

  return {
    slotsCreés,
    recettesMatchées,
    message: recettesMatchées > 0
      ? `${slotsCreés} repas générés dont ${recettesMatchées} liés à vos recettes`
      : `${slotsCreés} repas générés`,
  }
}
