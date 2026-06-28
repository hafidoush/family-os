import { db } from '../db/database'
import { appelOpenAI } from './openaiService'
import type { Recette, RecetteIngredient, Produit } from '../../shared/types'

export interface AnalyseRecette {
  recetteId: string
  recetteNom: string
  statut: 'ok' | 'adapter' | 'remplacer'
  conseil: string
}

export interface RecetteJoker {
  nom: string
  description: string
  temps?: string
}

export interface ResultatManques {
  analyses: AnalyseRecette[]
  recetteJoker?: RecetteJoker
}

export async function conseillerManques(
  menuId: string,
  manquesTexte: string,
): Promise<ResultatManques> {
  // 1. Récupère les recettes du menu
  const slots = await db.menuSlots.filter(s => s.menu === menuId && !s.archive).toArray()
  const recetteIds = [...new Set(slots.map(s => s.recette).filter(Boolean) as string[])]

  if (recetteIds.length === 0) throw new Error('Aucune recette dans ce menu')

  const recettesRaw = await db.recettes.bulkGet(recetteIds)
  const recettesValides = recettesRaw.filter((r): r is Recette => r !== undefined)

  // 2. Charge les ingrédients de chaque recette
  const ingredients: RecetteIngredient[] = await db.recettesIngredients
    .filter((ri: RecetteIngredient) => recetteIds.includes(ri.recette))
    .toArray()

  const produitIds = [...new Set(ingredients.map((i: RecetteIngredient) => i.produit))] as string[]
  const produitsRaw = await db.produits.bulkGet(produitIds)
  const produitsMap = new Map(produitsRaw.filter((p): p is Produit => p !== undefined).map(p => [p.id, p.nom]))

  // 3. Construit la liste par recette
  const recettesAvecIngredients = recettesValides.map((r: Recette) => {
    const ings = ingredients
      .filter((i: RecetteIngredient) => i.recette === r.id)
      .map((i: RecetteIngredient) => {
        const nom = produitsMap.get(i.produit) ?? 'ingrédient'
        return i.quantite ? `${i.quantite}${i.unite ? ' ' + i.unite : ''} ${nom}` : nom
      })
    return { id: r.id, nom: r.nom, ingredients: ings }
  })

  // 4. Prompt
  const listeRecettes = recettesAvecIngredients
    .map(r => `- ${r.nom} (ID: ${r.id})\n  Ingrédients: ${r.ingredients.join(', ') || 'non renseignés'}`)
    .join('\n')

  const prompt = `Tu es un assistant culinaire pour une famille française.
Voici les recettes planifiées pour la semaine :

${listeRecettes}

L'utilisateur dit qu'il lui manque : "${manquesTexte}"

Pour chaque recette, indique :
- "ok" si elle peut être faite sans problème malgré les manques
- "adapter" si elle est faisable avec une substitution simple (propose laquelle, 1 phrase max)
- "remplacer" si elle est trop impactée par les manques (trop d'ingrédients clés manquants)

Si au moins une recette est à "remplacer", invente aussi une recette joker simple et savoureuse réalisable avec ce qu'il reste (sans les ingrédients manquants). Donne-lui un nom accrocheur, une description courte et un temps estimé.

Réponds UNIQUEMENT en JSON valide, sans markdown ni backticks :
{
  "analyses": [
    { "recetteId": "id_exact", "recetteNom": "nom", "statut": "ok|adapter|remplacer", "conseil": "texte court" }
  ],
  "recetteJoker": { "nom": "...", "description": "...", "temps": "20 min" }
}
recetteJoker est optionnel — inclus-le seulement si au moins une recette est à remplacer.`

  const raw = await appelOpenAI(prompt, { temperature: 0.6, maxTokens: 1200, jsonMode: true })
  const match = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim().match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Réponse IA invalide')

  return JSON.parse(match[0]) as ResultatManques
}
