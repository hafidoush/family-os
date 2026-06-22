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

// ─── Types internes ───────────────────────────────────────────────────────────

interface RecetteAvecCategorie {
  nom: string
  categorie: string // nom de la catégorie
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

// Catégories qui ne peuvent pas constituer un repas complet seules
const CATEGORIES_ACCOMPAGNEMENT = new Set([
  'Sauce',
  'Légumes & Accompagnement',
  'Entrée',
  'Soupe',
])

// Catégories considérées comme plat principal
const CATEGORIES_PLAT_PRINCIPAL = new Set([
  'Plat principal',
])

function buildPromptMenus(recettes: RecetteAvecCategorie[], nbPersonnes: number): string {
  if (recettes.length === 0) {
    throw new Error('Aucune recette disponible. Ajoutez des recettes avant de générer un menu.')
  }

  const saison = getSaison()
  const dateAujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const plats = recettes.filter(r => CATEGORIES_PLAT_PRINCIPAL.has(r.categorie))
  const accompagnements = recettes.filter(r => CATEGORIES_ACCOMPAGNEMENT.has(r.categorie))
  const autres = recettes.filter(r =>
    !CATEGORIES_PLAT_PRINCIPAL.has(r.categorie) && !CATEGORIES_ACCOMPAGNEMENT.has(r.categorie)
  )

  const formatListe = (liste: RecetteAvecCategorie[]) =>
    liste.slice(0, 60).map(r => `- ${r.nom} [${r.categorie}]`).join('\n')

  const listePlats = formatListe(plats.length > 0 ? plats : [...plats, ...autres])
  const listeAccomp = accompagnements.length > 0 ? `\nAccompagnements & compléments disponibles :\n${formatListe(accompagnements)}` : ''

  return `Tu es un assistant culinaire pour une famille française. Génère un plan de repas pour une semaine complète (déjeuner + dîner) pour ${nbPersonnes} personne${nbPersonnes > 1 ? 's' : ''}.

Date du jour : ${dateAujourdhui}
Saison actuelle : ${saison.nom} — ${saison.description}

RÈGLES ABSOLUES :
1. Chaque repas doit être un PLAT PRINCIPAL complet. Utilise en priorité les recettes de la section "Plats principaux".
2. Si tu sélectionnes un plat qui semble incomplet seul (ex : poisson grillé nature, sardines, etc.), associe-lui un accompagnement de la liste "Accompagnements" pour former un repas complet. Dans ce cas, indique les deux noms séparés par " + " (ex: "Sardines à la charmoula + Frites maison").
3. NE jamais sélectionner une Sauce, un Accompagnement, une Entrée ou une Soupe comme repas principal unique.
4. N'invente AUCUNE recette. Utilise EXCLUSIVEMENT les noms exacts ci-dessous.

Plats principaux disponibles :
${listePlats}
${listeAccomp}

Contraintes de saisonnalité (PRIORITÉ HAUTE) :
- Nous sommes en ${saison.nom}. Privilégie en priorité les recettes adaptées à cette saison : ${saison.description}.
- En été : évite gratins, mijotés lourds, raclettes, fondues. Préfère grillades, salades composées, plats froids.
- En hiver : privilégie plats chauds, soupes-repas complètes, mijotés, gratins.

Autres contraintes :
- Repas variés (pas deux fois la même recette dans la même semaine si possible)
- Le week-end : privilégie les recettes plus festives ou familiales si disponibles
- Utilise le nom exact tel qu'il apparaît dans la liste (avec " + " si accompagnement associé)

Retourne UNIQUEMENT un objet JSON valide sans markdown, sans backticks, sans commentaires.

Format attendu :
{
  "lundi":    { "dejeuner": "nom exact du plat", "diner": "nom exact du plat" },
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

// Résout un nom de plat (potentiellement "plat + accompagnement") vers un ou deux recetteIds
async function trouverRecetteIds(nomPlat: string): Promise<string[]> {
  const recettes = await db.recettes.filter(r => !r.archive && !r.deletedAt).toArray()

  const resoudreUn = (nom: string): string | undefined => {
    const cible = normaliser(nom)
    const exacte = recettes.find(r => normaliser(r.nom) === cible)
    if (exacte) return exacte.id
    const partielle = recettes.find(r => {
      const n = normaliser(r.nom)
      return cible.includes(n) || n.includes(cible)
    })
    return partielle?.id
  }

  // L'IA peut retourner "Plat A + Accompagnement B"
  const parties = nomPlat.split('+').map(s => s.trim()).filter(Boolean)
  const ids: string[] = []
  for (const partie of parties) {
    const id = resoudreUn(partie)
    if (id) ids.push(id)
  }
  return ids
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
  const recettes = await db.recettes.filter(r => !r.archive && !r.deletedAt).toArray()
  const categories = await db.categoriesRecettes.toArray()
  const catById = new Map(categories.map(c => [c.id, c.nom]))

  const recettesAvecCat: RecetteAvecCategorie[] = recettes.map(r => ({
    nom: r.nom,
    categorie: catById.get(r.categorie) ?? 'Plat principal',
  }))

  // 2. Appel OpenAI
  const plan = await appelOpenAIMenus(buildPromptMenus(recettesAvecCat, nbPersonnes))

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

      // L'IA peut retourner "Plat + Accompagnement" — on crée un slot par recette trouvée
      const recetteIds = await trouverRecetteIds(nomPlat)

      if (recetteIds.length === 0) {
        console.warn(`[MenuIA] Recette(s) introuvable(s) ignorée(s) : "${nomPlat}"`)
        continue
      }

      for (const recetteId of recetteIds) {
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
    message: recettesMatchées > 0
      ? `${slotsCreés} repas générés dont ${recettesMatchées} liés à vos recettes`
      : `${slotsCreés} repas générés`,
  }
}
