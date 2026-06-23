/**
 * FAMILY OS — genererMenusService
 *
 * Génère une semaine de repas (déjeuner + dîner) via OpenAI,
 * puis crée les MenuSlots correspondants dans Dexie.
 *
 * Stratégie :
 *  1. Charge les recettes existantes et les envoie à l'IA avec leurs IDs.
 *  2. L'IA retourne un plan JSON structuré (7 jours × 2 repas) avec des IDs exacts.
 *  3. On crée les slots directement depuis les IDs — aucun matching approximatif.
 *  4. Si l'IA retourne un ID inconnu, on lève une erreur explicite.
 */

import { db } from '../db/database'
import { newEntity } from '../db/helpers'
import { appelOpenAI } from './openaiService'
import type { MenuSlot, JourMenu, TypeRepas } from '../../shared/types'

const JOURS: JourMenu[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

// ─── Saison ───────────────────────────────────────────────────────────────────

function getSaison(): { nom: string; mois: number; description: string } {
  const mois = new Date().getMonth() + 1
  if (mois >= 3 && mois <= 5) return { nom: 'printemps', mois, description: 'plats légers, légumes de saison (asperges, petits pois, radis), saveurs fraîches' }
  if (mois >= 6 && mois <= 8) return { nom: 'été', mois, description: 'plats frais et légers, salades, grillades, gazpachos, tomates, courgettes, poivrons' }
  if (mois >= 9 && mois <= 11) return { nom: 'automne', mois, description: 'plats réconfortants, champignons, potiron, courges, pommes, châtaignes' }
  return { nom: 'hiver', mois, description: 'plats chauds et nourrissants, gratins, soupes, légumineuses, ragoûts, endives, poireaux' }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecetteAvecCategorie {
  id: string
  nom: string
  categorie: string
}

// Chaque repas = tableau d'IDs (1 plat seul ou [plat, accompagnement])
interface RepasIA {
  dejeuner: string[]
  diner: string[]
}

type PlanSemaineIA = Record<JourMenu, RepasIA>

// ─── Catégories métier ────────────────────────────────────────────────────────

const CATEGORIES_ACCOMPAGNEMENT = new Set([
  'Sauce',
  'Légumes & Accompagnement',
  'Accompagnement',
  'Entrée',
  'Entrées & Salades',
  'Soupe',
])

const CATEGORIES_PLAT_PRINCIPAL = new Set([
  'Plat principal',
])

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPromptMenus(recettes: RecetteAvecCategorie[], nbPersonnes: number): string {
  if (recettes.length === 0) {
    throw new Error('Aucune recette disponible. Ajoutez des recettes avant de générer un menu.')
  }

  const saison = getSaison()
  const dateAujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const plats          = recettes.filter(r => CATEGORIES_PLAT_PRINCIPAL.has(r.categorie))
  const accompagnements = recettes.filter(r => CATEGORIES_ACCOMPAGNEMENT.has(r.categorie))
  const autres          = recettes.filter(r =>
    !CATEGORIES_PLAT_PRINCIPAL.has(r.categorie) && !CATEGORIES_ACCOMPAGNEMENT.has(r.categorie)
  )

  // Format : id | nom | catégorie
  const formatListe = (liste: RecetteAvecCategorie[]) =>
    liste.slice(0, 60).map(r => `${r.id} | ${r.nom} | ${r.categorie}`).join('\n')

  const listePlats  = formatListe(plats.length > 0 ? plats : [...plats, ...autres])
  const listeAccomp = accompagnements.length > 0
    ? `\nACCOMPAGNEMENTS DISPONIBLES (à associer uniquement si le plat principal est insuffisant seul) :\n${formatListe(accompagnements)}`
    : ''

  return `Tu es un assistant culinaire pour une famille française. Génère un plan de repas pour une semaine complète (déjeuner + dîner) pour ${nbPersonnes} personne${nbPersonnes > 1 ? 's' : ''}.

Date du jour : ${dateAujourdhui}
Saison actuelle : ${saison.nom} — ${saison.description}

RÈGLES ABSOLUES :
1. Utilise EXCLUSIVEMENT les recettes listées ci-dessous. N'invente aucune recette.
2. Chaque repas doit être constitué d'un PLAT PRINCIPAL complet. Utilise en priorité les recettes de la section "PLATS PRINCIPAUX".
3. Si un plat principal semble insuffisant seul (poisson nature, sardines, etc.), tu peux ajouter UN accompagnement de la liste "ACCOMPAGNEMENTS" en second élément du tableau.
4. NE JAMAIS retourner une Sauce, un Accompagnement, une Entrée ou une Soupe comme seul élément d'un repas.
5. Les identifiants retournés doivent être COPIÉS EXACTEMENT depuis la liste ci-dessous. Aucun autre ID n'est accepté.

PLATS PRINCIPAUX DISPONIBLES :
(format : ID | Nom | Catégorie)
${listePlats}
${listeAccomp}

CONTRAINTES DE SAISONNALITÉ (PRIORITÉ HAUTE) :
- Nous sommes en ${saison.nom}. Privilégie en priorité les recettes adaptées à cette saison : ${saison.description}.
- En été : évite gratins, mijotés lourds, raclettes, fondues. Préfère grillades, salades composées, plats froids.
- En hiver : privilégie plats chauds, soupes-repas complètes, mijotés, gratins.

AUTRES CONTRAINTES :
- Repas variés (pas deux fois le même ID dans la même semaine si possible)
- Le week-end : privilégie les recettes plus festives ou familiales si disponibles

FORMAT DE RÉPONSE :
- Chaque repas est un tableau d'IDs.
- Cas standard (plat complet seul) : ["id_exact"]
- Cas plat + accompagnement : ["id_plat", "id_accompagnement"]

Retourne UNIQUEMENT un objet JSON valide sans markdown, sans backticks, sans commentaires.

{
  "lundi":    { "dejeuner": ["id_exact"], "diner": ["id_exact"] },
  "mardi":    { "dejeuner": ["id_exact"], "diner": ["id_exact"] },
  "mercredi": { "dejeuner": ["id_exact"], "diner": ["id_exact"] },
  "jeudi":    { "dejeuner": ["id_exact"], "diner": ["id_exact"] },
  "vendredi": { "dejeuner": ["id_exact"], "diner": ["id_exact"] },
  "samedi":   { "dejeuner": ["id_exact"], "diner": ["id_exact"] },
  "dimanche": { "dejeuner": ["id_exact"], "diner": ["id_exact"] }
}`
}

// ─── Appel OpenAI ─────────────────────────────────────────────────────────────

async function appelOpenAIMenus(prompt: string): Promise<PlanSemaineIA> {
  const raw     = await appelOpenAI(prompt, 0.7)
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const match   = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Réponse OpenAI invalide — JSON non trouvé')
  return JSON.parse(match[0]) as PlanSemaineIA
}

// ─── Validation des IDs retournés par l'IA ───────────────────────────────────

function validerIdsIA(
  plan: PlanSemaineIA,
  idsValides: Set<string>,
): { idsInconnus: string[] } {
  const idsInconnus: string[] = []
  for (const jour of JOURS) {
    const jourPlan = plan[jour]
    if (!jourPlan) continue
    for (const ids of [jourPlan.dejeuner, jourPlan.diner]) {
      if (!Array.isArray(ids)) continue
      for (const id of ids) {
        if (id && !idsValides.has(id)) idsInconnus.push(id)
      }
    }
  }
  return { idsInconnus }
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
  // 1. Charger les recettes avec leurs catégories
  const recettes   = await db.recettes.filter(r => !r.archive && !r.deletedAt).toArray()
  const categories = await db.categoriesRecettes.toArray()
  const catById    = new Map(categories.map(c => [c.id, c.nom]))

  const recettesAvecCat: RecetteAvecCategorie[] = recettes.map(r => ({
    id:       r.id,
    nom:      r.nom,
    categorie: catById.get(r.categorie) ?? 'Plat principal',
  }))

  const idsValides = new Set(recettes.map(r => r.id))

  // 2. Appel OpenAI
  const plan = await appelOpenAIMenus(buildPromptMenus(recettesAvecCat, nbPersonnes))

  // 3. Valider que tous les IDs retournés existent réellement
  const { idsInconnus } = validerIdsIA(plan, idsValides)
  if (idsInconnus.length > 0) {
    throw new Error(
      `L'IA a retourné ${idsInconnus.length} identifiant(s) inconnu(s). Réessayez la génération.`
    )
  }

  // 4. Supprimer les slots existants du menu
  const slotsExistants = await db.menuSlots.filter(s => s.menu === menuId && !s.archive).toArray()
  await Promise.all(slotsExistants.map(s => db.menuSlots.delete(s.id)))

  // 5. Créer les nouveaux slots
  let slotsCreés      = 0
  let recettesMatchées = 0

  const repasTypes: { key: 'dejeuner' | 'diner'; type: TypeRepas }[] = [
    { key: 'dejeuner', type: 'dejeuner' },
    { key: 'diner',    type: 'diner' },
  ]

  for (const jour of JOURS) {
    const jourPlan = plan[jour]
    if (!jourPlan) continue

    for (const { key, type } of repasTypes) {
      const ids = jourPlan[key]
      if (!Array.isArray(ids) || ids.length === 0) continue

      for (const recetteId of ids) {
        if (!recetteId) continue
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
  }

  return {
    slotsCreés,
    recettesMatchées,
    message: `${slotsCreés} repas générés à partir de ${recettesMatchées} recettes de votre catalogue`,
  }
}
