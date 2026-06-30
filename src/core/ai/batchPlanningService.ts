/**
 * FAMILY OS — batchPlanningService
 * F8 : Génération du planning batch cooking via OpenAI.
 *
 * Deux appels distincts :
 *   1. structurerEtapesRecette — enrichit chaque étape (durée, type, équipement).
 *      Résultat mis en cache sur la recette (etapesStructurees + etapesStructureesHash).
 *      Ne rappelle pas l'IA si les étapes n'ont pas changé depuis la dernière structuration.
 *
 *   2. genererPlanningSession — reçoit les recettes déjà structurées et produit une
 *      timeline optimisée + conseils de conservation.
 *      Stocké sur SessionPreparation.planning.
 */

import { db } from '../db/database'
import { withUpdate } from '../db/helpers'
import { appelOpenAI } from './openaiService'
import type { Recette, EtapeStructuree, PlanningGenere, SessionPreparation } from '../../shared/types'

// ─── Hash simple (djb2) ───────────────────────────────────────────────────────

function hashEtapes(etapes: string[]): string {
  const str = JSON.stringify(etapes)
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
    h = h >>> 0 // force unsigned 32-bit
  }
  return h.toString(16)
}

// ─── 1. Structuration des étapes d'une recette ────────────────────────────────

function buildPromptStructuration(recette: Recette): string {
  return `Tu structures les étapes d'une recette de cuisine à partir d'un texte libre.
Pour chaque étape donnée en entrée (liste de strings), tu dois déterminer :
- une durée estimée en minutes (dureeMinutes) — si non mentionnée explicitement, fais une estimation réaliste selon le type d'action
- un type : "actif" (nécessite la présence de la personne : couper, mélanger, pétrir, éplucher, fouetter, verser, surveiller en remuant) ou "passif" (autonome une fois lancé : cuisson au four, repos, lévée, marinade, réfrigération, refroidissement)
- l'équipement utilisé, parmi : "four", "plaque" (cuisson sur plaque/poêle), "robot" (robot pâtissier/mixeur électrique), "plan_de_travail" (préparation manuelle sans appareil), "frigo", ou "aucun" si non applicable. Une étape peut utiliser plusieurs équipements.

Si une étape est ambiguë, fais l'hypothèse la plus courante en cuisine familiale française plutôt que de bloquer.

Réponds UNIQUEMENT avec un JSON valide, sans texte ni markdown autour, conforme exactement à ce format :
{"etapes":[{"id":"etape-0","description":"texte original inchangé","dureeMinutes":10,"type":"actif","equipement":["plan_de_travail"]}]}

DONNÉES DE LA RECETTE :
${JSON.stringify({ nom: recette.nom, etapes: recette.etapes })}`
}

export async function structurerEtapesRecette(recette: Recette): Promise<EtapeStructuree[]> {
  // Cache valide → pas d'appel IA
  const hash = hashEtapes(recette.etapes)
  if (recette.etapesStructurees && recette.etapesStructureesHash === hash) {
    return recette.etapesStructurees
  }

  // Recette sans étapes → rien à structurer
  if (recette.etapes.length === 0) {
    return []
  }

  const raw = await appelOpenAI(buildPromptStructuration(recette), {
    model: 'gpt-4o-mini',
    temperature: 0,
    maxTokens: 2048,
    jsonMode: true,
  })

  let etapesStructurees: EtapeStructuree[]
  try {
    const parsed = JSON.parse(raw) as { etapes?: EtapeStructuree[] }
    if (!Array.isArray(parsed.etapes)) throw new Error('Format inattendu')
    etapesStructurees = parsed.etapes
  } catch {
    throw new Error('Réponse IA invalide lors de la structuration des étapes')
  }

  // Sauvegarde en cache sur la recette
  await db.recettes.update(recette.id, withUpdate<Recette>({
    etapesStructurees,
    etapesStructureesHash: hash,
  }))

  return etapesStructurees
}

// ─── 2. Génération du planning de la session ─────────────────────────────────

interface RecettePayload {
  id: string
  nom: string
  portions?: number
  modeConservation?: string
  dureeConservation?: number
  congelable?: boolean
  etapesStructurees: EtapeStructuree[]
}

function buildPromptPlanning(recettes: RecettePayload[]): string {
  return `Tu es un expert en organisation de cuisine professionnelle, spécialisé dans l'optimisation de sessions de batch cooking familial. Tu reçois une liste de recettes avec leurs étapes structurées (description, durée, type actif/passif, équipement) ainsi que leurs informations de conservation, et tu dois produire un planning d'exécution optimisé sous forme de JSON strict.

RÈGLES ABSOLUES POUR LA TIMELINE :
1. Une seule personne exécute les étapes actives — jamais deux étapes "actif" en simultané, même sur des équipements différents.
2. Deux étapes ne peuvent jamais utiliser le même équipement en simultané (four, plaque, robot, plan_de_travail), qu'elles soient actives ou passives.
3. Les étapes passives peuvent se dérouler en parallèle d'étapes actives d'autres recettes, à condition de respecter la règle 2.
4. Priorise le lancement des étapes à plus long temps de repos/cuisson en premier.
5. Minutage RELATIF (T+0 = début de la session).
6. Si conflit d'équipement impossible à paralléliser, séquence-le dans la timeline et signale-le dans "alertesEquipement".
7. "dureeTotaleMinutes" = fin réelle de la dernière tâche, pas la somme brute de toutes les étapes.

RÈGLES POUR LA CONSERVATION :
8. Pour chaque recette, donne un conseil concret et spécifique pour préserver le goût et la texture sur toute la semaine (dans quel contenant, à quel moment congeler vs réfrigérer, comment réchauffer sans dénaturer).
9. Si le mode/durée de conservation n'est pas renseigné, propose une recommandation standard raisonnable selon le type de plat, et mentionne que c'est une estimation dans "conseils".

FORMAT DE SORTIE : JSON valide uniquement, sans texte ni markdown autour, conforme exactement à ce schéma :
{"dureeTotaleMinutes":0,"timeline":[{"tempsDebut":0,"tempsFin":0,"taches":[{"recetteId":"","etapeId":"","description":"","type":"actif","equipement":[]}]}],"conservation":[{"recetteId":"","recetteNom":"","modeConservation":"","dureeConservationJours":0,"conseil":""}],"conseils":[],"alertesEquipement":[]}

DONNÉES DE LA SESSION :
${JSON.stringify(recettes)}`
}

export async function genererPlanningSession(sessionId: string): Promise<void> {
  const session = await db.sessionsPreparation.get(sessionId)
  if (!session) throw new Error('Session introuvable')

  // Charge toutes les recettes de la session
  const recettes = (await Promise.all(
    session.recetteIds.map(id => db.recettes.get(id))
  )).filter(Boolean) as Recette[]

  if (recettes.length === 0) return

  // Structuration de celles qui en ont besoin (en parallèle)
  await Promise.all(recettes.map(r => structurerEtapesRecette(r)))

  // Recharge après mise à jour du cache
  const recettesStructurees = (await Promise.all(
    session.recetteIds.map(id => db.recettes.get(id))
  )).filter(Boolean) as Recette[]

  // Filtre les recettes sans étapes (elles figureront dans conservation uniquement)
  const payload: RecettePayload[] = recettesStructurees.map(r => ({
    id: r.id,
    nom: r.nom,
    portions: r.portions,
    modeConservation: r.modeConservation,
    dureeConservation: r.dureeConservation,
    congelable: r.congelable,
    etapesStructurees: r.etapesStructurees ?? [],
  }))

  const raw = await appelOpenAI(buildPromptPlanning(payload), {
    model: 'gpt-4o-mini',
    temperature: 0,
    maxTokens: 4096,
    jsonMode: true,
  })

  let planning: PlanningGenere
  try {
    const parsed = JSON.parse(raw) as Partial<PlanningGenere>
    if (typeof parsed.dureeTotaleMinutes !== 'number' || !Array.isArray(parsed.timeline)) {
      throw new Error('Format inattendu')
    }
    planning = {
      dureeTotaleMinutes: parsed.dureeTotaleMinutes,
      timeline: parsed.timeline ?? [],
      conservation: parsed.conservation ?? [],
      conseils: parsed.conseils ?? [],
      alertesEquipement: parsed.alertesEquipement ?? [],
      genereLe: new Date().toISOString(),
    }
  } catch {
    throw new Error('Réponse IA invalide lors de la génération du planning')
  }

  await db.sessionsPreparation.update(sessionId, withUpdate<SessionPreparation>({ planning }))
}

// ─── Cochage d'une tâche pendant l'exécution ─────────────────────────────────

export async function cocherTachePlanning(
  sessionId: string,
  recetteId: string,
  etapeId: string,
  fait: boolean,
): Promise<void> {
  const session = await db.sessionsPreparation.get(sessionId)
  if (!session?.planning) return

  const timeline = session.planning.timeline.map(bloc => ({
    ...bloc,
    taches: bloc.taches.map(t =>
      t.recetteId === recetteId && t.etapeId === etapeId ? { ...t, fait } : t
    ),
  }))

  await db.sessionsPreparation.update(sessionId, withUpdate<SessionPreparation>({
    planning: { ...session.planning, timeline },
  }))
}
