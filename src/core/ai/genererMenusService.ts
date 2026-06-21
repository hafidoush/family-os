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

// ─── Saison ───────────────────────────────────────────────────────────────────

function getSaison(): { nom: string; mois: number; description: string } {
  const mois = new Date().getMonth() + 1 // 1-12
  if (mois >= 3 && mois <= 5) return { nom: 'printemps', mois, description: 'plats légers, légumes de saison (asperges, petits pois, radis), saveurs fraîches' }
  if (mois >= 6 && mois <= 8) return { nom: 'été', mois, description: 'plats frais et légers, salades, grillades, gazpachos, tomates, courgettes, poivrons' }
  if (mois >= 9 && mois <= 11) return { nom: 'automne', mois, description: 'plats réconfortants, champignons, potiron, courges, pommes, châtaignes' }
  return { nom: 'hiver', mois, description: 'plats chauds et nourrissants, gratins, soupes, légumineuses, ragoûts, endives, poireaux' }
}

// ─── Types réponse Gemini ─────────────────────────────────────────────────────

interface RepasIA {
  dejeuner: string
  diner: string
}

type PlanSemaineIA = Record<JourMenu, RepasIA>

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPromptMenus(recettesExistantes: string[], nbPersonnes: number): string {
  if (recettesExistantes.length === 0) {
    throw new Error('Aucune recette disponible. Ajoutez des recettes avant de générer un menu.')
  }

  const saison = getSaison()
  const dateAujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const listeRecettes = recettesExistantes.slice(0, 80).map(r => `- ${r}`).join('\n')

  return `Tu es un assistant culinaire pour une famille française. Génère un plan de repas pour une semaine complète (déjeuner + dîner) pour ${nbPersonnes} personne${nbPersonnes > 1 ? 's' : ''}.

Date du jour : ${dateAujourdhui}
Saison actuelle : ${saison.nom} — ${saison.description}

RÈGLE ABSOLUE : tu dois choisir EXCLUSIVEMENT parmi les recettes listées ci-dessous.
Ne crée AUCUNE nouvelle recette. N'invente aucun plat. Si une case ne peut pas être remplie avec une recette de la liste, utilise une recette existante plutôt qu'en inventer une.

Recettes disponibles :
${listeRecettes}

Contraintes de saisonnalité (PRIORITÉ HAUTE) :
- Nous sommes en ${saison.nom}. Privilégie en priorité les recettes adaptées à cette saison : ${saison.description}.
- Utilise ton jugement pour identifier quelles recettes de la liste sont légères/estivales vs. consistantes/hivernales.
- En été : évite les gratins, plats longuement mijotés, raclettes, fondues et plats très riches. Préfère salades composées, grillades, plats froids ou rapides.
- En hiver : privilégie les plats chauds, soupes, mijotés, réconfortants.
- Si peu de recettes correspondent à la saison, tu peux utiliser des recettes neutres (pâtes simples, riz, omelettes…).

Autres contraintes :
- Repas variés (pas deux fois la même recette dans la même semaine si possible)
- Le week-end : privilégie les recettes plus festives ou familiales si disponibles
- Utilise le nom exact de la recette tel qu'il apparaît dans la liste ci-dessus

Retourne UNIQUEMENT un objet JSON valide sans markdown, sans backticks, sans commentaires.

Format attendu :
{
  "lundi":    { "dejeuner": "nom exact de la recette", "diner": "nom exact de la recette" },
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
  const recettes = await db.recettes.filter(r => !r.archive && !r.deletedAt).toArray()
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
  // 1. Charger les recettes existantes pour le prompt (exclure supprimées ET archivées)
  const recettes = await db.recettes.filter(r => !r.archive && !r.deletedAt).toArray()
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

      // Si l'IA a respecté la consigne, recetteId est toujours défini.
      // En cas d'invention malgré tout, on ignore le slot plutôt que de
      // créer un repas sans recette réelle.
      if (!recetteId) {
        console.warn(`[MenuIA] Recette introuvable ignorée : "${nomPlat}"`)
        continue
      }

      recettesMatchées++
      await db.menuSlots.add(newEntity<MenuSlot>({
        menu:    menuId,
        jour:    assignerJours ? jour : undefined,
        repas:   type,
        recette: recetteId,
        statut:  'prevue',
        archive: false,
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
