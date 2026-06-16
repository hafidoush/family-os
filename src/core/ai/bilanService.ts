/**
 * FAMILY OS — bilanService
 *
 * Génère un texte de bilan hebdomadaire personnalisé via GPT-4o-mini.
 * Graceful degradation : si pas de clé → retourne null (widget affiche le bilan sans texte IA).
 */

import { appelOpenAI, hasOpenAIKey } from './openaiService'
import type { WeeklyBilan } from '../../modules/dashboard/hooks/useWeeklyBilan'

function buildPromptBilan(bilan: WeeklyBilan): string {
  const { semaineCourante: sc, semaineSuivante: ss, points, score } = bilan

  const lignes = [
    `Score global : ${score}/100`,
    `Activités réalisées cette semaine : ${sc.activitesRealisees} sur ${sc.activitesTotal}`,
    `Jours avec menus planifiés : ${sc.menusCouvertsJours}`,
    ss.menusPlannifies ? 'Menus semaine prochaine : planifiés' : 'Menus semaine prochaine : manquants',
    ss.coursesPresentes ? 'Liste de courses : prête' : 'Liste de courses : vide',
    ss.activitesPlannifies > 0 ? `Activités semaine prochaine : ${ss.activitesPlannifies} prévues` : 'Activités semaine prochaine : aucune',
    ss.lingEnRetard ? 'Linge : en retard' : 'Linge : à jour',
    ss.aspirateurEnRetard ? 'Aspirateur : en retard' : 'Aspirateur : à jour',
    sc.tachesUrgentes > 0 ? `Tâches en retard : ${sc.tachesUrgentes}` : 'Tâches : à jour',
    sc.penseesPendantes > 0 ? `Pensées en attente : ${sc.penseesPendantes}` : '',
  ].filter(Boolean)

  return `Tu es l'assistant bienveillant d'une application familiale française.
Voici le bilan de la semaine de l'utilisatrice :

${lignes.join('\n')}

Rédige UN SEUL paragraphe court (2-3 phrases maximum, ton calme et encourageant, sans points d'exclamation) qui résume honnêtement la semaine et ce qu'il reste à préparer.
Commence directement le texte, sans titre. Tutoie l'utilisatrice. Sois précis et concret.`
}

export async function genererTexteBilan(bilan: WeeklyBilan): Promise<string | null> {
  if (!hasOpenAIKey()) return null
  try {
    const texte = await appelOpenAI(buildPromptBilan(bilan), 0.5)
    return texte.trim() || null
  } catch {
    return null
  }
}
