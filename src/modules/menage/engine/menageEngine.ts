/**
 * Moteur de décision Ménage — Family OS
 *
 * Sélectionne chaque matin les tâches ménagères à afficher,
 * en équilibrant charge, fréquence, retard et répartition spatiale.
 *
 * Pur TypeScript, sans dépendance UI ni Dexie.
 * Appelé depuis les hooks/composants avec les tâches déjà chargées.
 */

import type { Tache, FrequenceTache } from '@shared/types/entities'

// ─── Types publics ────────────────────────────────────────────────────────────

export type MenageMode = 'normal' | 'grandMenage' | 'receptionInvites' | 'rattrapage'

export interface MenageTask extends Tache {
  // Champs enrichis calculés par le moteur (non persistés)
  _intervalDays:     number
  _toleranceWindow:  number
  _difficulty:       1 | 2 | 3
  _visualImpact:     1 | 2 | 3
  _healthImportance: 1 | 2 | 3
  _urgencyScore:     number
  _overdueDays:      number
  _missedCount:      number
}

export interface ModeConfig {
  difficultyCap:          number   // points de difficulté cumulés max
  maxIntensif:            number   // nombre max de tâches difficulty=3
  durationCap:            number   // minutes indicatives
  includeAllOverdue:      boolean  // inclure toutes les tâches en retard sans limite
  includeTopMissed:       number   // inclure les N plus manquées (mode rattrapage)
  prioritizeVisualImpact: boolean  // favoriser les tâches visibles (réception)
  focusRooms:             string[] // restreindre aux pièces données ([] = toutes)
}

// ─── Presets de modes ─────────────────────────────────────────────────────────

export const MODE_CONFIGS: Record<MenageMode, ModeConfig> = {
  normal: {
    difficultyCap:          7,
    maxIntensif:            1,
    durationCap:            45,
    includeAllOverdue:      false,
    includeTopMissed:       0,
    prioritizeVisualImpact: false,
    focusRooms:             [],
  },
  grandMenage: {
    difficultyCap:          14,
    maxIntensif:            3,
    durationCap:            120,
    includeAllOverdue:      true,
    includeTopMissed:       0,
    prioritizeVisualImpact: false,
    focusRooms:             [],
  },
  receptionInvites: {
    difficultyCap:          8,
    maxIntensif:            1,
    durationCap:            60,
    includeAllOverdue:      false,
    includeTopMissed:       0,
    prioritizeVisualImpact: true,
    focusRooms:             ['salon', 'cuisine', 'salle_de_bain', 'entrée', 'toilettes'],
  },
  rattrapage: {
    difficultyCap:          10,
    maxIntensif:            2,
    durationCap:            90,
    includeAllOverdue:      false,
    includeTopMissed:       5,
    prioritizeVisualImpact: false,
    focusRooms:             [],
  },
}

// ─── Conversion frequence → intervalDays ─────────────────────────────────────

export function intervalFromFrequence(frequence: FrequenceTache): number {
  switch (frequence) {
    case 'quotidienne':    return 1
    case 'hebdomadaire':   return 7
    case 'bihebdomadaire': return 14
    case 'mensuelle':      return 30
    case 'trimestrielle':  return 90
    case 'semestrielle':   return 180
    case 'annuelle':       return 365
    case 'ponctuelle':     return 0
  }
}

// Fenêtre de tolérance par défaut selon l'intervalle
function defaultTolerance(intervalDays: number): number {
  if (intervalDays <= 1)   return 0
  if (intervalDays <= 7)   return 1
  if (intervalDays <= 14)  return 2
  if (intervalDays <= 30)  return 5
  if (intervalDays <= 90)  return 7
  if (intervalDays <= 180) return 14
  return 30
}

// ─── Jitter déterministe ──────────────────────────────────────────────────────
// Basé sur l'ID de la tâche — stable et reproductible, évite les accumulations.

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function jitterDays(taskId: string, toleranceWindow: number): number {
  if (toleranceWindow === 0) return 0
  const range = toleranceWindow * 2 + 1
  return (hashId(taskId) % range) - toleranceWindow
}

// ─── Calcul nextDue ───────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function computeNextDue(task: Tache, today: Date): Date {
  const intervalDays = intervalFromFrequence(task.frequence ?? 'ponctuelle')
  if (intervalDays === 0) {
    return task.dateEcheance ? new Date(task.dateEcheance) : today
  }

  const toleranceWindow = defaultTolerance(intervalDays)
  const base = task.completeeLe
    ? addDays(startOfDay(new Date(task.completeeLe)), intervalDays)
    : task.dateReference
      ? startOfDay(new Date(task.dateReference))
      : startOfDay(today)

  const jitter = jitterDays(task.id, toleranceWindow)
  return addDays(base, jitter)
}

// ─── Enrichissement des tâches ────────────────────────────────────────────────
// Ajoute les champs calculés (_intervalDays, _urgencyScore, etc.) sans muter la DB.

export function enrichTask(task: Tache, today: Date): MenageTask {
  const intervalDays    = intervalFromFrequence(task.frequence ?? 'ponctuelle')
  const toleranceWindow = defaultTolerance(intervalDays)

  // Lire depuis les champs persistés (initialisés par la migration v14)
  // avec fallback sur les défauts si la tâche n'a pas encore été migrée
  const missedCount      = task.missedCount            ?? 0
  const difficulty       = task.menageDifficulty       ?? 2
  const visualImpact     = task.menageVisualImpact     ?? 2
  const healthImportance = task.menageHealthImportance ?? 1

  const nextDue    = computeNextDue(task, today)
  const overdueDays = Math.round(
    (startOfDay(today).getTime() - startOfDay(nextDue).getTime()) / 86400000
  )

  // Formule d'urgence (cf. spec)
  const toleranceRatio = toleranceWindow > 0 ? overdueDays / toleranceWindow : overdueDays
  const urgencyScore =
    (toleranceRatio   * 40) +
    (healthImportance * 20) +
    (visualImpact     * 15) +
    (missedCount      * 15) +
    ((4 - difficulty) * 10)

  return {
    ...task,
    _intervalDays:     intervalDays,
    _toleranceWindow:  toleranceWindow,
    _difficulty:       difficulty,
    _visualImpact:     visualImpact,
    _healthImportance: healthImportance,
    _urgencyScore:     urgencyScore,
    _overdueDays:      overdueDays,
    _missedCount:      missedCount,
  }
}

// ─── Filtrage éligibilité ─────────────────────────────────────────────────────

function isEligible(task: MenageTask, today: Date, mode: ModeConfig): boolean {
  // Tâche en pause "Pas aujourd'hui"
  const skippedUntil = (task as Tache & { skippedUntil?: Date | null }).skippedUntil
  if (skippedUntil && startOfDay(new Date(skippedUntil)) > startOfDay(today)) return false

  // Abandon temporaire après 5 oublis consécutifs (sauf modes intensifs)
  if (task._missedCount >= 5 && !mode.includeAllOverdue) return false

  // Restriction aux pièces ciblées (réception invités)
  if (mode.focusRooms.length > 0 && task.pieceAssociee) {
    if (!mode.focusRooms.some(r => task.pieceAssociee?.toLowerCase().includes(r))) {
      return false
    }
  }

  // Dans la fenêtre d'éligibilité : nextDue - today <= toleranceWindow
  // (overdueDays positif = en retard → toujours éligible)
  // (overdueDays négatif = en avance → éligible si dans la fenêtre)
  if (task._overdueDays < -task._toleranceWindow) return false

  return true
}

// ─── Sélection avec plafond de charge ─────────────────────────────────────────

function applyLoadCap(
  candidates: MenageTask[],
  dailies: MenageTask[],
  mode: ModeConfig,
): MenageTask[] {
  const selected: MenageTask[] = []
  let cumulDifficulty = 0
  let cumulIntensif   = 0

  // Les quotidiennes sont pré-incluses et consomment le plafond
  for (const t of dailies) {
    cumulDifficulty += t._difficulty
    if (t._difficulty === 3) cumulIntensif++
    selected.push(t)
  }

  for (const t of candidates) {
    if (cumulDifficulty + t._difficulty > mode.difficultyCap) continue
    if (t._difficulty === 3 && cumulIntensif >= mode.maxIntensif) continue
    selected.push(t)
    cumulDifficulty += t._difficulty
    if (t._difficulty === 3) cumulIntensif++
  }

  return selected
}

// ─── Équilibre spatial (max 40% par pièce) ───────────────────────────────────
// Itératif — évite tout risque de récursion infinie.

function applyRoomBalance(
  selected: MenageTask[],
  allCandidates: MenageTask[],
): MenageTask[] {
  const MAX_ROOM_RATIO = 0.4
  if (selected.length < 3) return selected

  const MAX_PASSES = 10 // garde de sécurité absolue
  let pass = 0

  while (pass < MAX_PASSES) {
    pass++
    const total = selected.length
    const maxAllowed = Math.floor(total * MAX_ROOM_RATIO)

    // Comptage par pièce
    const roomCount = new Map<string, number>()
    for (const t of selected) {
      const room = t.pieceAssociee ?? '_none'
      roomCount.set(room, (roomCount.get(room) ?? 0) + 1)
    }

    // Chercher une pièce dominante
    let swapped = false
    for (const [room, count] of roomCount.entries()) {
      if (count <= maxAllowed || room === '_none') continue

      // Tâche la moins urgente de cette pièce (non-quotidienne)
      const fromRoom = selected
        .filter(t => t.pieceAssociee === room && t.frequence !== 'quotidienne')
        .sort((a, b) => a._urgencyScore - b._urgencyScore)

      if (fromRoom.length === 0) continue

      const toRemove = fromRoom[0]
      const selectedIds = new Set(selected.map(t => t.id))

      // Substitut : première tâche éligible d'une autre pièce
      const substitute = allCandidates.find(
        t => t.pieceAssociee !== room && !selectedIds.has(t.id)
      )

      if (!substitute) continue // Pas de substitut dispo → on laisse tel quel

      const idx = selected.findIndex(t => t.id === toRemove.id)
      if (idx !== -1) {
        selected.splice(idx, 1, substitute)
        swapped = true
        break // Reprendre la boucle depuis le début avec la nouvelle sélection
      }
    }

    if (!swapped) break // Aucune substitution nécessaire → terminé
  }

  return selected
}

// ─── Fonction principale ──────────────────────────────────────────────────────

export function selectTasksForToday(
  allTasks: Tache[],
  today: Date = new Date(),
  mode: MenageMode = 'normal',
): MenageTask[] {
  const config = MODE_CONFIGS[mode]

  // Exclure les tâches supprimées / archivées / ponctuelles sans échéance
  const active = allTasks.filter(
    t => !t.archive && !(t as Tache & { deletedAt?: Date }).deletedAt
      && t.moduleOrigine === 'maison'
      && t.recurrence
      && t.frequence !== 'ponctuelle'
  )

  // Enrichir toutes les tâches
  const enriched = active.map(t => enrichTask(t, today))

  // Séparer quotidiennes et périodiques
  const dailies    = enriched.filter(t => t.frequence === 'quotidienne')
  const periodics  = enriched.filter(t => t.frequence !== 'quotidienne')

  // Filtrer les éligibles
  const eligiblePeriodics = periodics.filter(t => isEligible(t, today, config))

  // Mode rattrapage : forcer les N tâches les plus manquées en tête
  let sortedPeriodics = [...eligiblePeriodics].sort((a, b) => b._urgencyScore - a._urgencyScore)

  if (config.includeTopMissed > 0) {
    const topMissed = [...periodics]
      .filter(t => t._missedCount > 0)
      .sort((a, b) => b._missedCount - a._missedCount)
      .slice(0, config.includeTopMissed)
    const topMissedIds = new Set(topMissed.map(t => t.id))
    // Injecter en tête, sans doublons
    sortedPeriodics = [
      ...topMissed,
      ...sortedPeriodics.filter(t => !topMissedIds.has(t.id)),
    ]
  }

  // Mode includeAllOverdue : forcer toutes les tâches en retard
  if (config.includeAllOverdue) {
    const overdueIds = new Set(sortedPeriodics.filter(t => t._overdueDays > 0).map(t => t.id))
    const remainingOverdue = periodics.filter(t => t._overdueDays > 0 && !overdueIds.has(t.id))
    sortedPeriodics = [...sortedPeriodics, ...remainingOverdue]
  }

  // Mode priorisation impact visuel (réception invités)
  if (config.prioritizeVisualImpact) {
    sortedPeriodics.sort((a, b) => {
      if (b._visualImpact !== a._visualImpact) return b._visualImpact - a._visualImpact
      return b._urgencyScore - a._urgencyScore
    })
  }

  // Appliquer le plafond de charge
  const withCap = applyLoadCap(sortedPeriodics, dailies, config)

  // Appliquer l'équilibre spatial
  const balanced = applyRoomBalance(withCap, sortedPeriodics)

  return balanced
}

// ─── Logique tâches non réalisées ────────────────────────────────────────────

// Patch à appliquer via TacheService.applyMenagePatch()
export interface MenagePatch {
  id:           string
  missedCount:  number
  skippedUntil: Date | null
}

/** @deprecated Utiliser MenagePatch */
export type MissedTaskUpdate = MenagePatch

/**
 * Calcule les mises à jour pour les tâches non cochées de la veille.
 * Renvoie les patches à appliquer via TacheService.applyMenagePatch().
 * Pur calcul, sans effets de bord.
 */
export function computeMissedUpdates(
  tasks: Tache[],
  yesterday: Date,
): MenagePatch[] {
  const updates: MenagePatch[] = []
  const sod = startOfDay(yesterday)

  for (const task of tasks) {
    if (!task.recurrence || task.frequence === 'ponctuelle') continue

    const enriched   = enrichTask(task, yesterday)
    const wasExpectedYesterday = enriched._overdueDays >= 0

    if (!wasExpectedYesterday) continue

    const completedYesterday =
      task.statut === 'fait' &&
      task.completeeLe &&
      startOfDay(new Date(task.completeeLe)).getTime() === sod.getTime()

    if (!completedYesterday) {
      const missedCount = enriched._missedCount + 1
      updates.push({
        id: task.id,
        missedCount,
        skippedUntil: null,
      })
    }
  }

  return updates
}

/**
 * Calcule le patch pour l'action "Pas aujourd'hui".
 * skippedUntil = demain, missedCount + 1.
 */
export function computeSkipPatch(
  task: Tache,
  today: Date,
): MenagePatch {
  const enriched = enrichTask(task, today)
  return {
    id:           task.id,
    missedCount:  enriched._missedCount + 1,
    skippedUntil: addDays(startOfDay(today), 1),
  }
}

/**
 * Détermine si une tâche doit déclencher une alerte légère (niveau 3).
 * Condition : missedCount >= 5 ET healthImportance >= 2.
 */
export function shouldAlertLevel3(task: MenageTask): boolean {
  return task._missedCount >= 5 && task._healthImportance >= 2
}

// ─── Initialisation au premier lancement ─────────────────────────────────────

export type StartupMode = 'entretien' | 'remiseEnOrdre' | 'nouveauDepart'
export type RoomState   = 'ok' | 'a_faire' | 'unknown'

/**
 * Calcule la date lastCompletedAt à utiliser pour initialiser une tâche.
 * Déterministe — pas d'effets de bord.
 */
export function computeInitialLastCompleted(
  intervalDays: number,
  startupMode: StartupMode,
  roomState: RoomState = 'unknown',
): Date {
  const today = startOfDay(new Date())

  if (startupMode === 'nouveauDepart') {
    return today // Tout repart à zéro
  }

  const ratioByRoom: Record<RoomState, number> = {
    ok:       0.3,
    a_faire:  1.2,
    unknown:  0.7,
  }

  let ratio: number
  if (startupMode === 'entretien') {
    // Déjà bien entretenu → légèrement en avance sur le calendrier
    ratio = roomState === 'a_faire' ? 0.8 : 0.5
  } else {
    // Remise en ordre → quelques tâches urgentes, les autres étalées
    ratio = ratioByRoom[roomState]
  }

  const daysBack = Math.round(intervalDays * ratio)
  return addDays(today, -daysBack)
}
