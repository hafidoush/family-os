// ─────────────────────────────────────────────────────────────────────────────
// FAMILY OS — Moteur d'automatisations
// Implémente les 42 règles (A-01 à A-42) du document d'automatisations
//
// Architecture : Event Bus + Rule Engine
//   1. Un service émet un AutomationEvent sur le bus
//   2. Le moteur trouve toutes les règles abonnées à cet événement
//   3. Chaque règle évalue sa condition puis exécute son action
// ─────────────────────────────────────────────────────────────────────────────

// ── Types du bus d'événements ─────────────────────────────────────────────────

export type AutomationEventType =
  // Cuisine
  | 'menu.validated'            // A-01
  | 'courses_item.added_manual' // A-02
  | 'produit.stock_low'         // A-03
  | 'courses_item.checked'      // A-04
  | 'dashboard.opened'          // A-05, A-07, A-11, A-19, A-26, A-27
  // Enfants
  | 'competence_suivi.status_changed' // A-08, A-09
  | 'enfant.created_or_updated'       // A-10
  | 'planification.status_changed'    // A-12
  // Maison
  | 'day.passed'                // A-13
  | 'tache.menage_completed'    // A-14
  | 'tache.projet_status_changed' // A-15, A-17, A-18
  | 'projet.completed'          // A-16
  // Famille & Achats
  | 'humeur.created'            // A-21
  | 'reunion.closed'            // A-22
  | 'wishlist_item.status_changed' // A-20, A-23, A-33
  | 'transaction.created_or_modified' // A-24
  | 'enveloppe.threshold_exceeded'    // A-25
  // Tâches transversales
  | 'tache.completed_recurrent'       // A-29
  | 'tache.completed_nonrecurrent'    // A-30
  | 'fab.pressed'               // A-31
  | 'produit.name_typed'        // A-32
  // Système
  | 'entity.created_or_modified'  // A-34, A-36
  | 'entity.archived'             // A-35
  | 'entity.master_archive_requested' // A-40
  | 'category_or_status.renamed' // A-41
  | 'app.first_launch'           // A-42
  | 'activite_programme.realised'  // A-45
  | 'import_recette.validated'     // A-46
  | 'sync.export_requested'        // A-37
  | 'sync.import_requested'      // A-38
  | 'entity.deleted'             // A-39

export interface AutomationEvent<T = unknown> {
  type: AutomationEventType
  payload: T
  timestamp: Date
  sourceModule?: string
}

export interface AutomationRule<T = unknown> {
  id: string               // ex: "A-01"
  name: string
  trigger: AutomationEventType | AutomationEventType[]
  condition?: (event: AutomationEvent<T>) => Promise<boolean> | boolean
  action: (event: AutomationEvent<T>) => Promise<void>
  enabled: boolean
}

// ── Moteur ────────────────────────────────────────────────────────────────────

class AutomationEngine {
  private rules: Map<string, AutomationRule> = new Map()
  private listeners: Map<AutomationEventType, Set<string>> = new Map()

  /** Enregistre une règle d'automatisation */
  register(rule: AutomationRule): void {
    this.rules.set(rule.id, rule)

    const triggers = Array.isArray(rule.trigger) ? rule.trigger : [rule.trigger]
    triggers.forEach(trigger => {
      if (!this.listeners.has(trigger)) {
        this.listeners.set(trigger, new Set())
      }
      this.listeners.get(trigger)!.add(rule.id)
    })

    if (import.meta.env.DEV) {
      console.log(`[AutoEngine] Règle enregistrée: ${rule.id} — ${rule.name}`)
    }
  }

  /** Émet un événement et exécute toutes les règles abonnées */
  async emit<T = unknown>(event: AutomationEvent<T>): Promise<void> {
    const ruleIds = this.listeners.get(event.type)
    if (!ruleIds || ruleIds.size === 0) return

    const executions = Array.from(ruleIds).map(async (ruleId) => {
      const rule = this.rules.get(ruleId) as AutomationRule<T> | undefined
      if (!rule || !rule.enabled) return

      try {
        const conditionMet = rule.condition
          ? await rule.condition(event)
          : true

        if (conditionMet) {
          if (import.meta.env.DEV) {
            console.log(`[AutoEngine] Exécution ${rule.id}: ${rule.name}`)
          }
          await rule.action(event)
        }
      } catch (error) {
        console.error(`[AutoEngine] Erreur dans la règle ${ruleId}:`, error)
      }
    })

    await Promise.all(executions)
  }

  /** Désactive une règle sans la supprimer */
  disable(ruleId: string): void {
    const rule = this.rules.get(ruleId)
    if (rule) rule.enabled = false
  }

  /** Réactive une règle */
  enable(ruleId: string): void {
    const rule = this.rules.get(ruleId)
    if (rule) rule.enabled = true
  }

  /** Liste toutes les règles enregistrées */
  listRules(): AutomationRule[] {
    return Array.from(this.rules.values())
  }
}

// ─── Instance singleton ───────────────────────────────────────────────────────
export const automationEngine = new AutomationEngine()

// ─── Helper pour émettre facilement ──────────────────────────────────────────
export function emit<T = unknown>(
  type: AutomationEventType,
  payload: T,
  sourceModule?: string
): Promise<void> {
  return automationEngine.emit({
    type,
    payload,
    timestamp: new Date(),
    sourceModule,
  })
}
