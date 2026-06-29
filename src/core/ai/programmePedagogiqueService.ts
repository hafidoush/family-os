/**
 * FAMILY OS — Service IA Génération Programmes Pédagogiques
 *
 * Stratégie :
 *  1. Charger le catalogue existant et les compétences disponibles
 *  2. Construire un prompt détaillé avec les contraintes pédagogiques
 *  3. Appeler GPT-4o (qualité pédagogique critique)
 *  4. Parser + valider le JSON retourné
 *  5. Persister via programmeService (programme + activités)
 *  6. Retourner l'id du programme créé
 */

import { db } from '../db/database'
import { newEntity } from '../db/helpers'
import { appelOpenAI } from './openaiService'
import {
  createProgramme,
  calculerNbSemaines,
  calculerDateFin,
} from '../../modules/enfants/programmes/services/programmeService'
import type {
  Activite,
  Competence,
  ProgrammePedagogique,
  ActiviteProgramme,
  SemaineProgramme,
  TachePreparation,
  DureeProgramme,
  DifficulteActivite,
  PhaseApprentissage,
  RepartitionMois,
  IntroductionTheme,
  ConclusionProgramme,
} from '../../shared/types'

// ─── Types IA internes ────────────────────────────────────────────────────────

interface ActiviteIABrute {
  source: 'catalogue' | 'generee_ia'
  activiteCatalogueId?: string
  titre: string
  description: string
  objectifPedagogique: string
  phase: PhaseApprentissage
  competencesTravaillees: string[]
  materielNecessaire: Array<{ nom: string; quantite?: string; aAcheter: boolean }>
  materielOptionnel: Array<{ nom: string; quantite?: string; aAcheter: boolean }>
  tempsPreparation: number
  duree: number
  ageRecommande: string
  deroulement: Array<{ ordre: number; texte: string; duree?: number; conseil?: string }>
  variantes?: Array<{ ageMin: number; ageMax: number; adaptation: string }>
  preparationSpecifique?: string[]
  ideesImmersion?: string[]
}

interface SemaineIABrute {
  numero: number
  titre: string
  objectif: string
  phase: PhaseApprentissage
  activites: ActiviteIABrute[]
  tachesPreparation: Array<{
    titre: string
    type: TachePreparation['type']
    urgence: TachePreparation['urgence']
    dureeEstimee: number
  }>
}

interface ProgrammeIABrut {
  titre: string
  description: string
  objectifsPedagogiques: string[]
  competencesCiblees: string[]
  semaines: SemaineIABrute[]
  introductionTheme?: IntroductionTheme
  conclusion?: ConclusionProgramme
  ideesImmersion?: string[]
}

// ─── Paramètres de génération ─────────────────────────────────────────────────

export interface ParamsGenerationProgramme {
  theme: string
  ageMin: number
  ageMax: number
  nbEnfants: number
  enfantsCibles: string[]             // Enfant.id[]
  duree: DureeProgramme
  frequenceParSemaine: number
  difficulte: DifficulteActivite
  objectifsSpecifiques?: string[]
  dateDebut: string                   // "YYYY-MM-DD"
  onProgress?: (etape: string, pct: number) => void
}

export interface ParamsGenerationAnnuelle {
  annee: number
  enfantsCibles: string[]
  ageMin: number
  ageMax: number
  onProgress?: (etape: string, pct: number) => void
}

// ─── Utilitaires prompt ───────────────────────────────────────────────────────

function resumeCatalogue(activites: Activite[]): string {
  return activites
    .filter(a => !a.archive)
    .slice(0, 60)
    .map(a => JSON.stringify({
      id:        a.id,
      nom:       a.nom,
      ageMin:    a.ageMin,
      ageMax:    a.ageMax,
      duree:     a.dureeEstimee,
      difficulte: a.difficulte,
      competences: a.competencesCiblees ?? [],
      objectif:  a.objectifPedagogique ?? '',
      materiel:  a.materiel ?? [],
    }))
    .join('\n')
}

function resumeCompetences(competences: Competence[]): string {
  return competences
    .map(c => `${c.id} | ${c.nom} | ${c.domaine}`)
    .join('\n')
}

// ─── Prompt génération programme ─────────────────────────────────────────────

function buildPromptProgramme(
  params: ParamsGenerationProgramme,
  catalogue: Activite[],
  competences: Competence[],
): string {
  const nbSemaines = calculerNbSemaines(params.duree)
  const activitesParSemaine = params.frequenceParSemaine
  const totalActivites = nbSemaines * activitesParSemaine
  const phasesParSemaine = repartirPhases(nbSemaines)
  const dureeMax = params.ageMin <= 3 ? '15–20 min' : params.ageMin <= 4 ? '20–30 min' : '30–45 min'

  // Filtre le catalogue : uniquement les activités dont le titre/objectif/tags contiennent des mots du thème
  const themeWords = params.theme.toLowerCase().split(/[\s_\-,]+/).filter(w => w.length > 3)
  const catalogueThematique = catalogue.filter(a => {
    const text = `${a.nom} ${a.objectifPedagogique ?? ''} ${(a.tags ?? []).join(' ')}`.toLowerCase()
    return themeWords.some(w => text.includes(w))
  })
  const catalogueGeneral = catalogue.filter(a => !catalogueThematique.includes(a))

  return `Tu es un concepteur pédagogique expert en éducation de la petite enfance (approches Montessori, Reggio Emilia, pédagogie active).

═══════════════════════════════════════════════════════
MISSION : Créer un programme d'apprentissage THÉMATIQUE
Thème central : "${params.theme}"
Enfants : ${params.ageMin}–${params.ageMax} ans | ${params.nbEnfants} enfant(s)
Durée : ${nbSemaines} semaine(s) × ${activitesParSemaine} activité(s) = ${totalActivites} activités au total
Difficulté : ${params.difficulte}
${params.objectifsSpecifiques?.length ? `Objectifs parentaux : ${params.objectifsSpecifiques.join(' / ')}` : ''}
═══════════════════════════════════════════════════════

PRINCIPE FONDAMENTAL — À RESPECTER POUR CHAQUE ACTIVITÉ :
Chaque activité doit directement servir la compréhension du thème "${params.theme}".
TEST OBLIGATOIRE avant de proposer une activité : "Est-ce que cette activité apprend quelque chose de précis sur ${params.theme} ?"
Si la réponse est non → rejeter l'activité et en trouver une autre.
Une activité générique comme "collage libre" ou "transvasement d'eau" n'est acceptable QUE si elle est thématisée (ex: "collage de silhouettes du corps humain", "transvasement pour comprendre le cycle de l'eau").

ÉTAPE 1 — PLANIFIER LA PROGRESSION THÉMATIQUE :
Avant toute activité, définis la progression en ${nbSemaines} sous-thème(s) distincts sur "${params.theme}" :
- Commence par les aspects concrets et observables
- Progresse vers les concepts plus abstraits ou les liens entre les éléments
- Chaque semaine explore UN aspect spécifique du thème (pas le thème en entier)

Phases imposées par semaine :
${phasesParSemaine.map(({ semaine, phase }) => `  Semaine ${semaine} → phase "${phase}"`).join('\n')}

ÉTAPE 2 — CONCEVOIR LES ACTIVITÉS THÉMATIQUES :
Pour chaque activité, l'objectifPedagogique doit répondre à : "À la fin de cette activité, l'enfant sera capable de [verbe d'action] sur [aspect du thème]".
Exemples CORRECTS pour le thème "corps humain" :
  ✓ "Nommer les parties du visage en les plaçant sur un schéma"
  ✓ "Associer chaque organe sensoriel à son sens correspondant"
  ✓ "Reconstituer une silhouette humaine en identifiant les membres"
Exemples INCORRECTS (activités génériques sans lien thématique) :
  ✗ "Développer la motricité fine" (sans lien au thème)
  ✗ "Explorer différentes textures" (trop générique)
  ✗ "Stimuler la créativité" (pas thématique)

ÉTAPE 3 — FORMAT DE CHAQUE ACTIVITÉ :
description : 2 phrases expliquant le contexte ET le lien au thème
objectifPedagogique : ce que l'enfant apprend sur le thème (verbe d'action précis)
deroulement : 3–5 étapes concrètes, chacune en lien avec l'exploration du thème
variantes : adaptations selon l'âge ${params.ageMin}–${params.ageMax} ans (simplification ou approfondissement)

CATALOGUE D'ACTIVITÉS THÉMATIQUES À RÉUTILISER EN PRIORITÉ :
${catalogueThematique.length > 0 ? resumeCatalogue(catalogueThematique) : '(aucune activité thématique dans le catalogue — générer entièrement)'}

CATALOGUE GÉNÉRAL (réutiliser UNIQUEMENT si l'activité peut être adaptée au thème, sinon ignorer) :
${resumeCatalogue(catalogueGeneral.slice(0, 20))}

RÈGLE CATALOGUE : Pour utiliser une activité du catalogue (source: "catalogue"), son objectifPedagogique doit contenir un lien explicite au thème "${params.theme}". Sinon, créer une nouvelle activité (source: "generee_ia") spécifiquement thématique.

CONSIGNE COMPLÉMENTAIRE — IMMERSION ET COHÉRENCE D'ENSEMBLE :
Les activités générées doivent rester adaptées au thème choisi et s'intégrer dans une aventure pédagogique globale. Chaque activité doit aider l'enfant à entrer dans l'univers du thème, développer sa curiosité et donner une cohérence à l'ensemble du programme.

COMPÉTENCES DISPONIBLES (format : ID | Nom | Domaine) :
${resumeCompetences(competences)}

⚠️ RÈGLE ABSOLUE SUR LES COMPÉTENCES :
Les champs "competencesCiblees" et "competencesTravaillees" ne peuvent contenir QUE des IDs copiés exactement depuis la liste ci-dessus.
N'invente aucun ID. Si aucune compétence ne correspond, utilise un tableau vide [].

CONTRAINTES TECHNIQUES :
- Durée par activité : ${dureeMax} (adapté à l'âge)
- Matériel : accessible, réaliste (maison, papeterie, imprimable, nature)
- aAcheter: true uniquement pour les éléments non courants
- Tâches de préparation : anticipent la semaine suivante (urgence: "prochaine_semaine") ou courante (urgence: "cette_semaine")

ÉTAPE 4 — INTRODUCTION DU THÈME (génère "introductionTheme" au niveau du programme) :
Avant la liste des activités, conçois une courte introduction pour aider l'adulte à lancer le programme :
- histoire : une histoire de départ courte qui plonge les enfants dans l'univers du thème "${params.theme}"
- presentation : une façon concrète de présenter le thème aux enfants (ce que l'adulte dit/montre)
- rituelLancement : un petit rituel à répéter pour lancer chaque séance/semaine
- miseEnScene : une idée de mise en scène (déguisement, mission, lieu transformé…) cohérente avec le thème

ÉTAPE 5 — PRÉPARATION ET IMMERSION PAR ACTIVITÉ (champs optionnels par activité, à remplir UNIQUEMENT quand pertinent) :
- preparationSpecifique : liste d'actions concrètes que l'adulte doit faire avant CETTE activité (impressions, fiches à découper, éléments à fabriquer, déco, indices à cacher, coin thématique à installer…)
- ideesImmersion : liste de petits accessoires ou idées de mise en scène propres à cette activité (badge, enveloppe de mission, gommettes, carte, déguisement léger…)
Ne remplis ces deux champs que s'ils apportent une réelle valeur immersive ; sinon laisse un tableau vide.

ÉTAPE 6 — BONUS IMMERSION GLOBAL (génère "ideesImmersion" au niveau du programme) :
Propose 3 à 6 idées d'accessoires/éléments d'immersion transverses à tout le programme (en complément du matériel pédagogique classique), qui rendent l'ensemble plus vivant (ex : badge d'explorateur, carnet de mission, carte ancienne, sac d'exploration…).

ÉTAPE 7 — CLÔTURE PÉDAGOGIQUE (génère "conclusion" au niveau du programme) :
Conçois une section de clôture pour la fin du programme :
- jeuFinal : un petit jeu final en lien avec le thème
- activiteRestitution : une activité où l'enfant restitue ce qu'il a appris/vécu
- ideeSouvenir : une idée de souvenir concret à garder du programme
- questionsBilan : 2-4 questions simples à poser aux enfants pour faire le bilan

FORMAT JSON (répondre UNIQUEMENT avec ce JSON, sans markdown, sans texte avant/après) :
{
  "titre": "Titre précis incluant le thème",
  "description": "Description en 2 phrases mentionnant le thème et la progression",
  "objectifsPedagogiques": ["Objectif thématique 1", "Objectif thématique 2", "Objectif thématique 3"],
  "competencesCiblees": ["<ID_EXACT_depuis_la_liste_COMPÉTENCES_DISPONIBLES>"],
  "introductionTheme": {
    "histoire": "Courte histoire de départ qui plonge les enfants dans l'univers du thème.",
    "presentation": "Comment l'adulte présente le thème aux enfants.",
    "rituelLancement": "Petit rituel à répéter pour lancer chaque séance.",
    "miseEnScene": "Idée de mise en scène cohérente avec le thème."
  },
  "ideesImmersion": ["Accessoire/idée bonus immersion 1", "Accessoire/idée bonus immersion 2"],
  "conclusion": {
    "jeuFinal": "Petit jeu final en lien avec le thème.",
    "activiteRestitution": "Activité où l'enfant restitue ce qu'il a appris.",
    "ideeSouvenir": "Idée de souvenir concret à garder du programme.",
    "questionsBilan": ["Question de bilan 1", "Question de bilan 2"]
  },
  "semaines": [
    {
      "numero": 1,
      "titre": "Semaine 1 — [Sous-thème précis de la semaine]",
      "objectif": "Ce que l'enfant comprendra sur [aspect du thème] cette semaine",
      "phase": "decouverte",
      "activites": [
        {
          "source": "generee_ia",
          "titre": "Nom de l'activité (doit évoquer le thème)",
          "description": "Ce qu'on fait ET pourquoi c'est lié au thème.",
          "objectifPedagogique": "À la fin, l'enfant sera capable de [verbe] sur [aspect du thème]",
          "phase": "decouverte",
          "competencesTravaillees": ["<ID_EXACT_depuis_la_liste_COMPÉTENCES_DISPONIBLES>"],
          "materielNecessaire": [{"nom": "silhouette du corps à imprimer", "quantite": "1", "aAcheter": false}],
          "materielOptionnel": [],
          "tempsPreparation": 10,
          "duree": 20,
          "ageRecommande": "${params.ageMin}–${params.ageMax} ans",
          "deroulement": [
            {"ordre": 1, "texte": "Étape concrète en lien avec le thème.", "duree": 5, "conseil": "Conseil pratique."},
            {"ordre": 2, "texte": "Étape suivante.", "duree": 10}
          ],
          "variantes": [
            {"ageMin": ${params.ageMin}, "ageMax": ${Math.min(params.ageMin + 1, params.ageMax)}, "adaptation": "Version simplifiée pour les plus jeunes."},
            {"ageMin": ${Math.max(params.ageMax - 1, params.ageMin)}, "ageMax": ${params.ageMax}, "adaptation": "Version enrichie pour les plus grands."}
          ],
          "preparationSpecifique": ["Action de préparation propre à cette activité (laisser [] si non pertinent)."],
          "ideesImmersion": ["Petit accessoire/idée immersive propre à cette activité (laisser [] si non pertinent)."]
        }
      ],
      "tachesPreparation": [
        {"titre": "Préparer le matériel thématique", "type": "imprimer", "urgence": "cette_semaine", "dureeEstimee": 15}
      ]
    }
  ]
}

Génère exactement ${nbSemaines} semaine(s) avec exactement ${activitesParSemaine} activité(s) chacune.
RAPPEL FINAL : Chaque activité doit enseigner quelque chose de précis sur "${params.theme}". Rejette mentalement toute activité qui pourrait figurer dans n'importe quel autre programme sans modification.
Réponds UNIQUEMENT avec le JSON valide.`
}

// ─── Répartition des phases sur les semaines ─────────────────────────────────

function repartirPhases(nbSemaines: number): Array<{ semaine: number; phase: PhaseApprentissage }> {
  const phases: PhaseApprentissage[] = [
    'decouverte',
    'exploration',
    'manipulation',
    'approfondissement',
    'consolidation',
  ]
  return Array.from({ length: nbSemaines }, (_, i) => {
    const index = Math.min(Math.floor((i / nbSemaines) * phases.length), phases.length - 1)
    return { semaine: i + 1, phase: phases[index] }
  })
}

// ─── Parsing + validation ─────────────────────────────────────────────────────

function nettoyerJSON(raw: string): string {
  return raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

const PHASES_VALIDES: PhaseApprentissage[] = [
  'decouverte', 'exploration', 'manipulation', 'approfondissement', 'consolidation',
]

function validerPhase(phase: unknown): PhaseApprentissage {
  if (typeof phase === 'string' && PHASES_VALIDES.includes(phase as PhaseApprentissage)) {
    return phase as PhaseApprentissage
  }
  return 'decouverte'
}

function validerActiviteIA(raw: ActiviteIABrute, ordre: number): Omit<ActiviteProgramme, 'id' | 'createdAt' | 'updatedAt' | 'deviceId'> {
  return {
    programmeId:           '',            // injecté après
    semaineNumero:         0,             // injecté après
    source:                raw.source === 'catalogue' ? 'catalogue' : 'generee_ia',
    activiteCatalogueId:   raw.activiteCatalogueId,
    titre:                 raw.titre ?? 'Activité sans titre',
    description:           raw.description ?? '',
    objectifPedagogique:   raw.objectifPedagogique ?? '',
    phase:                 validerPhase(raw.phase),
    competencesTravaillees: Array.isArray(raw.competencesTravaillees) ? raw.competencesTravaillees : [],
    materielNecessaire:    Array.isArray(raw.materielNecessaire) ? raw.materielNecessaire : [],
    materielOptionnel:     Array.isArray(raw.materielOptionnel) ? raw.materielOptionnel : [],
    tempsPreparation:      typeof raw.tempsPreparation === 'number' ? raw.tempsPreparation : 0,
    duree:                 typeof raw.duree === 'number' ? raw.duree : 20,
    ageRecommande:         raw.ageRecommande ?? '',
    deroulement:           Array.isArray(raw.deroulement) ? raw.deroulement : [],
    variantes:             Array.isArray(raw.variantes) ? raw.variantes : [],
    preparationSpecifique: Array.isArray(raw.preparationSpecifique) ? raw.preparationSpecifique : [],
    ideesImmersion:        Array.isArray(raw.ideesImmersion) ? raw.ideesImmersion : [],
    ordre,
    statutRealisation:     'a_faire',
    archive:               false,
  }
}

// ─── Persistance ─────────────────────────────────────────────────────────────

async function persisterProgramme(
  params: ParamsGenerationProgramme,
  brut: ProgrammeIABrut,
): Promise<string> {
  const { v4: uuidv4 } = await import('uuid')
  const { withDevice, withAudit } = await import('../db/helpers')

  // 1. Créer le programme (statut brouillon → sera activé après confirmation parent)
  const programmeId = await createProgramme(
    {
      titre:                brut.titre,
      theme:                params.theme,
      description:          brut.description,
      ageMin:               params.ageMin,
      ageMax:               params.ageMax,
      enfantsCibles:        params.enfantsCibles,
      duree:                params.duree,
      frequenceParSemaine:  params.frequenceParSemaine,
      difficulte:           params.difficulte,
      objectifsPedagogiques: brut.objectifsPedagogiques ?? [],
      competencesCiblees:   brut.competencesCiblees ?? [],
      dateDebut:            params.dateDebut,
      genereParIA:          true,
      modelIA:              'gpt-4o',
      introductionTheme:    brut.introductionTheme,
      conclusion:           brut.conclusion,
      ideesImmersion:       brut.ideesImmersion ?? [],
    },
    [], // semaines embarquées vides — on utilise la table activitesProgramme
  )

  // 2. Construire les semaines embarquées (sans activiteIds encore)
  const semaines: SemaineProgramme[] = brut.semaines.map(s => ({
    numero:    s.numero,
    titre:     s.titre,
    objectif:  s.objectif,
    phase:     validerPhase(s.phase),
    activiteIds: [],  // rempli après insertion des activités
    tachesPreparation: (s.tachesPreparation ?? []).map(t => ({
      id:            uuidv4(),
      titre:         t.titre,
      type:          t.type,
      urgence:       t.urgence,
      dureeEstimee:  t.dureeEstimee ?? 15,
      faite:         false,
    })),
  }))

  // 3. Insérer toutes les activités et collecter leurs ids par semaine
  // Charger les IDs de compétences valides pour filtrer les UUIDs inventés par l'IA
  const competencesValides = await db.competences.filter(c => !c.archive).toArray()
  const competenceIdsValides = new Set(competencesValides.map(c => c.id))

  const activiteIdsBySemaine: Record<number, string[]> = {}

  for (const semaineIA of brut.semaines) {
    const ids: string[] = []
    const activitesValidees = (semaineIA.activites ?? []).map((a, i) => {
      const activite = validerActiviteIA(a, i)
      // Filtrer les compétences : ne garder que les IDs qui existent réellement en base
      const invalides = activite.competencesTravaillees.filter(id => !competenceIdsValides.has(id))
      if (invalides.length > 0) {
        console.warn(`[IA] Semaine ${semaineIA.numero}, activité "${activite.titre}" : ${invalides.length} compétence(s) inventée(s) par l'IA ignorée(s)`)
      }
      activite.competencesTravaillees = activite.competencesTravaillees.filter(
        id => competenceIdsValides.has(id)
      )
      return activite
    })

    for (const activiteData of activitesValidees) {
      const activite = withDevice(withAudit({
        id: uuidv4(),
        ...activiteData,
        programmeId,
        semaineNumero: semaineIA.numero,
      })) as ActiviteProgramme
      await db.activitesProgramme.add(activite)
      ids.push(activite.id)
    }
    activiteIdsBySemaine[semaineIA.numero] = ids
  }

  // 4. Mettre à jour les semaines avec les ids réels
  const semainesAvecIds = semaines.map(s => ({
    ...s,
    activiteIds: activiteIdsBySemaine[s.numero] ?? [],
  }))
  await db.programmesPedagogiques.update(programmeId, { semaines: semainesAvecIds, updatedAt: new Date() })

  return programmeId
}

// ─── Fonction principale ──────────────────────────────────────────────────────

export interface ResultatGenerationProgramme {
  programmeId: string
  nbSemaines: number
  nbActivites: number
  nbActivitesCatalogue: number
  nbActivitesGenerees: number
}

export async function genererProgrammeIA(
  params: ParamsGenerationProgramme,
): Promise<ResultatGenerationProgramme> {
  const { onProgress } = params

  // Étape 1 — Charger le contexte
  onProgress?.('Analyse du catalogue…', 10)
  const [catalogue, competences] = await Promise.all([
    db.activites.filter(a => !a.archive).toArray(),
    db.competences.filter(c => !c.archive).toArray(),
  ])

  // Étape 2 — Construire le prompt
  onProgress?.('Construction du programme…', 25)
  const prompt = buildPromptProgramme(params, catalogue, competences)

  // Étape 3 — Appel GPT-4o
  onProgress?.('Génération IA en cours…', 40)
  const raw = await appelOpenAI(prompt, {
    model:       'gpt-4o',
    temperature: 0.7,
    maxTokens:   8192,
    jsonMode:    true,
  })

  // Étape 4 — Parser
  onProgress?.('Validation du contenu…', 70)
  const brut = JSON.parse(nettoyerJSON(raw)) as ProgrammeIABrut

  if (!brut.semaines || !Array.isArray(brut.semaines)) {
    throw new Error('Réponse IA invalide : structure "semaines" manquante')
  }

  // Étape 5 — Persister
  onProgress?.('Enregistrement du programme…', 85)
  const programmeId = await persisterProgramme(params, brut)

  // Étape 6 — Statistiques
  onProgress?.('Terminé', 100)
  const toutes = brut.semaines.flatMap(s => s.activites ?? [])
  const catalogue_ = toutes.filter(a => a.source === 'catalogue').length
  const generees  = toutes.filter(a => a.source === 'generee_ia').length

  return {
    programmeId,
    nbSemaines:             brut.semaines.length,
    nbActivites:            toutes.length,
    nbActivitesCatalogue:   catalogue_,
    nbActivitesGenerees:    generees,
  }
}

// ─── Programme Annuel IA ──────────────────────────────────────────────────────

const THEMES_ANNUELS = [
  { mois: 9,  theme: 'rentree_ecole',     sousTheme: 'Organisation et nouveauté' },
  { mois: 10, theme: 'automne',           sousTheme: 'Nature, couleurs et récolte' },
  { mois: 11, theme: 'emotions',          sousTheme: 'Identifier et exprimer ses émotions' },
  { mois: 12, theme: 'hiver_fetes',       sousTheme: 'Partage, lumière et gratitude' },
  { mois: 1,  theme: 'corps_mouvement',   sousTheme: 'Motricité et conscience du corps' },
  { mois: 2,  theme: 'arts_creatifs',     sousTheme: 'Expression artistique libre' },
  { mois: 3,  theme: 'printemps_nature',  sousTheme: 'Éveil et croissance' },
  { mois: 4,  theme: 'animaux',           sousTheme: 'Découvrir le monde animal' },
  { mois: 5,  theme: 'sciences_eveil',    sousTheme: 'Expériences et curiosité' },
  { mois: 6,  theme: 'voyage_monde',      sousTheme: 'Cultures et géographie' },
  { mois: 7,  theme: 'ete_eau_soleil',    sousTheme: 'Jeux sensoriels estivaux' },
  { mois: 8,  theme: 'imaginaire',        sousTheme: 'Contes, jeux symboliques et créativité' },
]

export async function genererProgrammeAnnuelIA(
  params: ParamsGenerationAnnuelle,
): Promise<RepartitionMois[]> {
  const { onProgress } = params

  onProgress?.('Analyse des compétences existantes…', 10)
  const [competencesSuivi, activitesExistantes] = await Promise.all([
    db.competencesSuivi
      .where('enfant').anyOf(params.enfantsCibles)
      .filter(s => !s.archive)
      .toArray(),
    db.activites.filter(a => !a.archive).toArray(),
  ])

  const themesDejaCouverts = [...new Set(activitesExistantes.map(a => a.tags ?? []).flat())]

  onProgress?.('Génération du parcours annuel…', 30)

  const prompt = `Tu es un expert en pédagogie de la petite enfance.
Génère un parcours pédagogique annuel pour des enfants de ${params.ageMin ?? 2}–${params.ageMax ?? 6} ans, pour l'année ${params.annee}.

THÈMES DE BASE (adapte et enrichis) :
${THEMES_ANNUELS.map(t => `- Mois ${t.mois} : ${t.theme} (${t.sousTheme})`).join('\n')}

THÈMES DÉJÀ COUVERTS DANS LE CATALOGUE (éviter les répétitions exactes) :
${themesDejaCouverts.slice(0, 20).join(', ') || 'aucun'}

COMPÉTENCES EN COURS D'ACQUISITION :
${competencesSuivi.filter(s => s.statut === 'en_cours').slice(0, 10).map(s => s.competence).join(', ') || 'non renseignées'}

RÈGLES :
1. Respecter les saisons (mois 9 = septembre, 12 = décembre, etc.)
2. Alterner : nature / corps / arts / émotions / langages / sciences / monde
3. Progresser en complexité : thèmes concrets en début d'année, plus abstraits en fin
4. Chaque mois doit avoir des compétences prioritaires distinctes

Réponds UNIQUEMENT avec un JSON : tableau de 12 objets avec cette structure :
[
  {
    "mois": 9,
    "theme": "rentree_ecole",
    "sousTheme": "...",
    "competencesPrioritaires": ["langage", "social_emotionnel"],
    "raisonPedagogique": "Une phrase expliquant le choix de ce thème ce mois-ci."
  }
]`

  const raw = await appelOpenAI(prompt, {
    model:       'gpt-4o-mini',
    temperature: 0.6,
    maxTokens:   2048,
    jsonMode:    true,
  })

  onProgress?.('Finalisation…', 90)

  const raw_parsed = JSON.parse(nettoyerJSON(raw))
  // json_object mode ne permet pas un tableau racine — l'IA wraps dans un objet avec une clé quelconque
  let parsed: RepartitionMois[] = []
  if (Array.isArray(raw_parsed)) {
    parsed = raw_parsed
  } else if (raw_parsed && typeof raw_parsed === 'object') {
    // Cherche le premier tableau qui contient des objets avec un champ "mois"
    const found = Object.values(raw_parsed).find(
      v => Array.isArray(v) && v.length > 0 && typeof (v as unknown[])[0] === 'object' && 'mois' in ((v as unknown[])[0] as object)
    )
    parsed = (found as RepartitionMois[]) ?? []
  }
  return parsed
}
