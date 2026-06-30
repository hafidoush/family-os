/**
 * FAMILY OS — batchPlanningService
 * F8 : Génération du protocole batch cooking via OpenAI (3 phases).
 *
 * Phase 1 — Mise en place :
 *   - listeCourses : calculée en CODE depuis RecetteIngredient (pas d'IA)
 *   - preparationAmont : généré par l'IA (mise en place avant de commencer)
 *
 * Phase 2 — Exécution :
 *   - timeline optimisée avec règle de regroupement d'actions similaires
 *
 * Phase 3 — Clôture :
 *   - recapFinal : message de clôture généré par l'IA
 *
 * Cache étapes : structurerEtapesRecette utilise un hash djb2 pour ne pas
 * rappeler l'IA si les étapes n'ont pas changé.
 */

import { db } from '../db/database'
import { withUpdate } from '../db/helpers'
import { appelOpenAI } from './openaiService'
import type {
  Recette,
  EtapeStructuree,
  PlanningGenere,
  SessionPreparation,
  IngredientAgrege,
  EtapePreparation,
} from '../../shared/types'

// ─── Hash simple (djb2) ───────────────────────────────────────────────────────

function hashEtapes(etapes: string[]): string {
  const str = JSON.stringify(etapes)
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
    h = h >>> 0
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
  const hash = hashEtapes(recette.etapes)
  if (recette.etapesStructurees && recette.etapesStructureesHash === hash) {
    return recette.etapesStructurees
  }

  if (recette.etapes.length === 0) return []

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

  await db.recettes.update(recette.id, withUpdate<Recette>({
    etapesStructurees,
    etapesStructureesHash: hash,
  }))

  return etapesStructurees
}

// ─── 2. Agrégation des ingrédients (code, pas IA) ────────────────────────────

export async function agregerIngredients(
  recetteIds: string[],
  recettesParId: Map<string, string>,
): Promise<IngredientAgrege[]> {
  const lignes = await db.recettesIngredients
    .where('recette')
    .anyOf(recetteIds)
    .toArray()

  if (lignes.length === 0) return []

  const produitIds = [...new Set(lignes.map(l => l.produit))]
  const produits = await Promise.all(produitIds.map(id => db.produits.get(id)))
  const produitNom = new Map<string, string>()
  for (const p of produits) {
    if (p) produitNom.set(p.id, p.nom)
  }

  // Clé = produitId + '|' + (unite ?? '') — deux lignes si même produit mais unités différentes
  const map = new Map<string, IngredientAgrege>()

  for (const ligne of lignes) {
    const key = `${ligne.produit}|${ligne.unite ?? ''}`
    const recetteNom = recettesParId.get(ligne.recette) ?? ligne.recette

    if (map.has(key)) {
      const entry = map.get(key)!
      entry.quantiteTotale += ligne.quantite
      if (ligne.optionnel) entry.optionnel = true
      entry.recettesConcernees.push({ recetteId: ligne.recette, recetteNom, quantite: ligne.quantite })
    } else {
      map.set(key, {
        produitId: ligne.produit,
        nom: produitNom.get(ligne.produit) ?? ligne.produit,
        quantiteTotale: ligne.quantite,
        unite: ligne.unite,
        optionnel: ligne.optionnel,
        recettesConcernees: [{ recetteId: ligne.recette, recetteNom, quantite: ligne.quantite }],
        fait: false,
      })
    }
  }

  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

// ─── 3. Génération du planning (prompt complet 3 phases) ─────────────────────

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
  return `Tu es un expert en organisation de cuisine professionnelle, spécialisé dans le batch cooking familial. Tu reçois une liste de recettes avec leurs étapes structurées (description, durée, type actif/passif, équipement) ainsi que leurs informations de conservation. Tu dois produire un protocole complet de batch cooking en 3 phases, sous forme de JSON strict.

PHASE 1 — PRÉPARATION AMONT (preparationAmont) :
Identifie les actions de mise en place à faire AVANT la première étape active : sortir des ingrédients à l'avance (beurre, œufs), préchauffer le four si pertinent tôt, sortir le matériel (robot, moules, plaques), peser des ingrédients secs en avance si plusieurs recettes en utilisent. Liste courte et concrète. Associe recetteId si spécifique à une recette, sinon laisse null.

PHASE 2 — TIMELINE D'EXÉCUTION (timeline) :
1. Une seule personne exécute les étapes actives — jamais deux "actif" en simultané, même sur équipements différents.
2. Deux étapes ne partagent jamais le même équipement en simultané (four, plaque, robot, plan_de_travail).
3. Les étapes passives peuvent tourner en parallèle d'étapes actives d'autres recettes, sous réserve de la règle 2.
4. Priorise le lancement des étapes à plus long repos/cuisson en premier.
5. Minutage RELATIF (T+0 = début de session).
6. Si conflit d'équipement impossible à paralléliser, séquence-le et signale-le dans alertesEquipement.
7. dureeTotaleMinutes = fin réelle de la dernière tâche.
8. RÈGLE DE REGROUPEMENT (prioritaire) : avant de placer les tâches, identifie les actions IDENTIQUES ou TRÈS SIMILAIRES requises par plusieurs recettes au même moment du process (ex: beurrer et fariner un moule, préchauffer le four, peser de la farine, casser des œufs, étaler une pâte). Quand c'est le cas, REGROUPE-les en une seule tâche batchée qui mentionne explicitement toutes les recettes concernées (ex: "Beurrer et fariner les 3 moules : fondant, brownie, gâteau au yaourt") plutôt que de répéter la même action en plusieurs tâches séparées. Pour une tâche batchée, recetteIds contiendra les ids de TOUTES les recettes concernées. C'est le principe central du batch cooking : ne jamais faire deux fois un geste identique à des moments différents s'il peut être fait une seule fois pour toutes les recettes concernées.

PHASE 3 — CLÔTURE (recapFinal) :
Message court (3-4 phrases), chaleureux et concret, récapitulant ce qui a été préparé et rappelant les 2-3 points de conservation les plus critiques pour préserver goût et texture sur la semaine.

RÈGLES CONSERVATION (conservation) :
Pour chaque recette, conseil concret (contenant, moment de congélation vs frigo, réchauffage). Si non renseigné, recommandation standard raisonnable, précisée comme estimation.

FORMAT DE SORTIE : JSON valide uniquement, sans texte ni markdown autour :
{"preparationAmont":[{"id":"prep-0","description":"","recetteId":null}],"dureeTotaleMinutes":0,"timeline":[{"tempsDebut":0,"tempsFin":0,"taches":[{"recetteIds":[],"etapeId":"","description":"","type":"actif","equipement":[],"fait":false}]}],"conservation":[{"recetteId":"","recetteNom":"","modeConservation":"","dureeConservationJours":0,"conseil":""}],"alertesEquipement":[],"recapFinal":""}

Si une information manque, fais une hypothèse raisonnable plutôt que de bloquer.

DONNÉES DE LA SESSION :
${JSON.stringify(recettes)}`
}

export async function genererPlanningSession(sessionId: string): Promise<void> {
  const session = await db.sessionsPreparation.get(sessionId)
  if (!session) throw new Error('Session introuvable')

  const recettes = (await Promise.all(
    session.recetteIds.map(id => db.recettes.get(id))
  )).filter(Boolean) as Recette[]

  if (recettes.length === 0) return

  await Promise.all(recettes.map(r => structurerEtapesRecette(r)))
  const recettesStructurees = (await Promise.all(
    session.recetteIds.map(id => db.recettes.get(id))
  )).filter(Boolean) as Recette[]

  console.group('[BatchPlanning] Payload structuration')
  for (const r of recettesStructurees) {
    console.log(`${r.nom} — etapes brutes: ${r.etapes.length}, etapesStructurees: ${r.etapesStructurees?.length ?? 0}`)
  }
  console.groupEnd()

  const recettesParId = new Map<string, string>(recettesStructurees.map(r => [r.id, r.nom]))

  const avecEtapes = recettesStructurees.filter(r => (r.etapesStructurees?.length ?? 0) > 0)
  const sansEtapes = recettesStructurees.filter(r => (r.etapesStructurees?.length ?? 0) === 0)

  if (avecEtapes.length === 0) {
    console.warn('[BatchPlanning] Aucune recette avec étapes structurées — planning vide attendu')
  }

  const payload: RecettePayload[] = [
    ...avecEtapes.map(r => ({
      id: r.id, nom: r.nom, portions: r.portions,
      modeConservation: r.modeConservation, dureeConservation: r.dureeConservation,
      congelable: r.congelable, etapesStructurees: r.etapesStructurees!,
    })),
    ...sansEtapes.map(r => ({
      id: r.id, nom: r.nom, portions: r.portions,
      modeConservation: r.modeConservation, dureeConservation: r.dureeConservation,
      congelable: r.congelable, etapesStructurees: [] as EtapeStructuree[],
    })),
  ]

  console.log('[BatchPlanning] Prompt payload :', payload.map(r => ({ nom: r.nom, nbEtapes: r.etapesStructurees.length })))

  const raw = await appelOpenAI(buildPromptPlanning(payload), {
    model: 'gpt-4o-mini',
    temperature: 0,
    maxTokens: 16000,
    jsonMode: true,
  })

  console.log('[BatchPlanning] Réponse brute longueur :', raw.length, 'chars')
  console.log('[BatchPlanning] Réponse brute (début) :', raw.slice(0, 600))

  let planning: PlanningGenere
  try {
    const parsed = JSON.parse(raw) as Partial<PlanningGenere> & {
      preparationAmont?: Array<{ id?: string; description?: string; recetteId?: string | null }>
    }
    if (typeof parsed.dureeTotaleMinutes !== 'number' || !Array.isArray(parsed.timeline)) {
      throw new Error('Format inattendu')
    }

    const listeCourses = await agregerIngredients(session.recetteIds, recettesParId)

    planning = {
      listeCourses,
      preparationAmont: (parsed.preparationAmont ?? []).map((e, i): EtapePreparation => ({
        id: e.id ?? `prep-${i}`,
        description: e.description ?? '',
        recetteId: e.recetteId ?? undefined,
        fait: false,
      })),
      dureeTotaleMinutes: parsed.dureeTotaleMinutes,
      timeline: parsed.timeline.map(bloc => ({
        ...bloc,
        taches: bloc.taches.map(t => ({ ...t, fait: false })),
      })),
      conservation: parsed.conservation ?? [],
      recapFinal: parsed.recapFinal ?? '',
      alertesEquipement: parsed.alertesEquipement ?? [],
      genereLe: new Date().toISOString(),
    }
  } catch {
    throw new Error('Réponse IA invalide lors de la génération du planning')
  }

  await db.sessionsPreparation.update(sessionId, withUpdate<SessionPreparation>({ planning }))
}

// ─── Cochage tâche timeline (par index bloc + index tâche) ───────────────────

export async function cocherTachePlanning(
  sessionId: string,
  blocIndex: number,
  taskIndex: number,
  fait: boolean,
): Promise<void> {
  const session = await db.sessionsPreparation.get(sessionId)
  if (!session?.planning) return

  const timeline = session.planning.timeline.map((bloc, bi) => ({
    ...bloc,
    taches: bloc.taches.map((t, ti) =>
      bi === blocIndex && ti === taskIndex ? { ...t, fait } : t
    ),
  }))

  await db.sessionsPreparation.update(sessionId, withUpdate<SessionPreparation>({
    planning: { ...session.planning, timeline },
  }))
}

// ─── Cochage étape de préparation amont ──────────────────────────────────────

export async function cocherEtapePreparation(
  sessionId: string,
  etapeId: string,
  fait: boolean,
): Promise<void> {
  const session = await db.sessionsPreparation.get(sessionId)
  if (!session?.planning) return

  const preparationAmont = (session.planning.preparationAmont ?? []).map(e =>
    e.id === etapeId ? { ...e, fait } : e
  )

  await db.sessionsPreparation.update(sessionId, withUpdate<SessionPreparation>({
    planning: { ...session.planning, preparationAmont },
  }))
}

// ─── Cochage ingrédient liste de courses ─────────────────────────────────────

export async function cocherIngredientCourses(
  sessionId: string,
  produitId: string,
  unite: string | undefined,
  fait: boolean,
): Promise<void> {
  const session = await db.sessionsPreparation.get(sessionId)
  if (!session?.planning) return

  const listeCourses = (session.planning.listeCourses ?? []).map(item =>
    item.produitId === produitId && item.unite === unite ? { ...item, fait } : item
  )

  await db.sessionsPreparation.update(sessionId, withUpdate<SessionPreparation>({
    planning: { ...session.planning, listeCourses },
  }))
}
