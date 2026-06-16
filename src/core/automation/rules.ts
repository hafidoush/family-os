// ─────────────────────────────────────────────────────────────────────────────
// FAMILY OS — Enregistrement des 42 règles d'automatisation
// Chaque règle référence son identifiant (A-01 … A-42)
// ─────────────────────────────────────────────────────────────────────────────

import { automationEngine } from './engine'
import { db, withAudit } from '@core/db/database'
import { withUpdate } from '@core/db/helpers'
import { getDeviceId } from '@core/sync/device'
import { v4 as uuid } from 'uuid'
import { useNotificationsStore } from '@shared/stores/notificationsStore'
import type {
  Menu, CoursesItem, Produit, CompetenceSuivi, Piece,
  ProjetMaison, Tache, WishlistItem, Transaction, Enveloppe,
  ActiviteProgramme,
} from '@shared/types'

// Payloads typés par événement
interface MenuValidatedPayload { menu: Menu }
interface CoursesItemAddedPayload { coursesItem: CoursesItem; nom: string }
interface ProduitStockLowPayload { produit: Produit }
interface CoursesItemCheckedPayload { coursesItem: CoursesItem }
interface CompetenceSuiviChangedPayload { competenceSuivi: CompetenceSuivi; previousStatut: string }
interface EnfantPayload { enfantId: string; dateNaissance: string }
interface PlanificationChangedPayload { planificationId: string; statut: string }
interface TacheMenagePayload { tache: Tache }
interface TacheProjetPayload { tache: Tache }
interface ProjetPayload { projet: ProjetMaison }
interface WishlistItemChangedPayload { item: WishlistItem; previousStatut?: string }
interface TransactionPayload { transaction: Transaction }
interface EnveloppePayload { enveloppe: Enveloppe }
interface TacheCompletedPayload { tache: Tache }
interface EntityPayload { entityId: string; tableName: string; data: Record<string, unknown> }
interface CategoryRenamedPayload { tableName: string; oldValue: string; newValue: string; field: string }
// Payloads A-37/A-38/A-40 — réservés, non encore câblés

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CUISINE
// ─────────────────────────────────────────────────────────────────────────────

// A-01 — Génération liste de courses depuis un menu validé
automationEngine.register({
  id: 'A-01',
  name: 'Génération liste de courses depuis un menu validé',
  trigger: 'menu.validated',
  condition: async (event) => {
    const { menu } = event.payload as MenuValidatedPayload
    const slots = await db.menuSlots.where('menu').equals(menu.id).toArray()
    return slots.some(slot => slot.recette != null)
  },
  action: async (event) => {
    const { menu } = event.payload as MenuValidatedPayload
    const deviceId = await getDeviceId()
    const slots = await db.menuSlots.where('menu').equals(menu.id).toArray()
    const recetteIds = [...new Set(slots.map(s => s.recette).filter(Boolean) as string[])]

    for (const recetteId of recetteIds) {
      const ingredients = await db.recettesIngredients.where('recette').equals(recetteId).toArray()

      for (const ingredient of ingredients) {
        // Fusion des doublons : si le produit est déjà en liste, additionner
        const existing = await db.coursesItems.where('produit').equals(ingredient.produit).first()

        if (existing && !existing.coche) {
          await db.coursesItems.update(existing.id, {
            quantite: (existing.quantite ?? 0) + ingredient.quantite,
            updatedAt: new Date(),
          })
        } else {
          const item: CoursesItem = {
            id: uuid(),
            produit: ingredient.produit,
            quantite: ingredient.quantite,
            unite: ingredient.unite,
            coche: false,
            source: 'menu',
            dateAjout: new Date(),
            ...withAudit({}),
            deviceId,
          }
          await db.coursesItems.add(item)
        }
      }
    }
  },
  enabled: true,
})

// A-02 — Création automatique d'une fiche produit depuis la liste de courses
automationEngine.register({
  id: 'A-02',
  name: 'Création automatique d\'une fiche produit depuis la liste de courses',
  trigger: 'courses_item.added_manual',
  condition: async (event) => {
    const { nom } = event.payload as CoursesItemAddedPayload
    const existing = await db.produits.where('nom').equalsIgnoreCase(nom).first()
    return !existing
  },
  action: async (event) => {
    const { nom, coursesItem } = event.payload as CoursesItemAddedPayload
    const deviceId = await getDeviceId()

    const produit: Produit = {
      id: coursesItem.produit,
      nom,
      type: 'consommable',
      categorie: '', // à compléter par l'utilisateur
      archive: false,
      ...withAudit({}),
      deviceId,
    }
    await db.produits.add(produit)
  },
  enabled: true,
})

// A-03 — Alerte stock faible → ajout automatique à la liste de courses
automationEngine.register({
  id: 'A-03',
  name: 'Alerte stock faible → ajout automatique à la liste de courses',
  trigger: 'produit.stock_low',
  condition: async (event) => {
    const { produit } = event.payload as ProduitStockLowPayload
    if (produit.type !== 'consommable') return false
    const existing = await db.coursesItems
      .where('produit').equals(produit.id)
      .filter(item => !item.coche)
      .first()
    return !existing
  },
  action: async (event) => {
    const { produit } = event.payload as ProduitStockLowPayload
    const deviceId = await getDeviceId()
    const quantiteSuggeree = produit.seuilAlerte ? produit.seuilAlerte * 2 : 1

    const item: CoursesItem = {
      id: uuid(),
      produit: produit.id,
      quantite: quantiteSuggeree,
      coche: false,
      source: 'stock_faible',
      dateAjout: new Date(),
      ...withAudit({}),
      deviceId,
    }
    await db.coursesItems.add(item)
  },
  enabled: true,
})

// A-04 — Mise à jour des stocks après validation des courses
automationEngine.register({
  id: 'A-04',
  name: 'Mise à jour des stocks après validation des courses',
  trigger: 'courses_item.checked',
  condition: async (event) => {
    const { coursesItem } = event.payload as CoursesItemCheckedPayload
    const produit = await db.produits.get(coursesItem.produit)
    return produit?.type === 'consommable' && produit?.stockActuel != null
  },
  action: async (event) => {
    const { coursesItem } = event.payload as CoursesItemCheckedPayload
    const produit = await db.produits.get(coursesItem.produit)
    if (!produit) return

    await db.produits.update(produit.id, {
      stockActuel: (produit.stockActuel ?? 0) + (coursesItem.quantite ?? 1),
      updatedAt: new Date(),
    })
  },
  enabled: true,
})

// A-06 — Fusion de doublons dans la liste de courses
// (intégrée dans A-01 et le service CoursesItem)

// ─────────────────────────────────────────────────────────────────────────────
// MODULE ENFANTS
// ─────────────────────────────────────────────────────────────────────────────

// A-08 — Suggestion d'activités depuis une compétence à travailler
automationEngine.register({
  id: 'A-08',
  name: 'Suggestion d\'activités depuis une compétence à travailler',
  trigger: 'competence_suivi.status_changed',
  condition: async (event) => {
    const { competenceSuivi } = event.payload as CompetenceSuiviChangedPayload
    return competenceSuivi.statut === 'en_cours'
  },
  action: async (event) => {
    const { competenceSuivi } = event.payload as CompetenceSuiviChangedPayload
    // Les activités suggérées sont lues côté UI via un query réactif Dexie
    // Ici on peut mettre à jour un état ou notifier l'interface
    console.log(`[A-08] Compétence ${competenceSuivi.competence} en cours — activités à suggérer`)
  },
  enabled: true,
})

// A-09 — Archivage d'une compétence acquise et suggestion de la suivante
automationEngine.register({
  id: 'A-09',
  name: 'Archivage d\'une compétence acquise et suggestion de la suivante',
  trigger: 'competence_suivi.status_changed',
  condition: async (event) => {
    const { competenceSuivi } = event.payload as CompetenceSuiviChangedPayload
    return competenceSuivi.statut === 'acquis'
  },
  action: async (event) => {
    const { competenceSuivi } = event.payload as CompetenceSuiviChangedPayload
    const deviceId = await getDeviceId()
    const today = new Date().toISOString().split('T')[0]

    // Horodater l'acquisition et archiver
    await db.competencesSuivi.update(competenceSuivi.id, {
      dateAcquisition: today,
      archive: true,
      updatedAt: new Date(),
    })

    // Créer la CompétenceSuivi suivante si définie
    const competence = await db.competences.get(competenceSuivi.competence)
    if (competence?.competenceSuivante) {
      const nextSuivi = {
        id: uuid(),
        enfant: competenceSuivi.enfant,
        competence: competence.competenceSuivante,
        statut: 'a_travailler' as const,
        archive: false,
        ...withAudit({}),
        deviceId,
      }
      await db.competencesSuivi.add(nextSuivi)
    }
  },
  enabled: true,
})

// A-10 — Création automatique d'un événement anniversaire
automationEngine.register({
  id: 'A-10',
  name: 'Création automatique d\'un événement anniversaire',
  trigger: 'enfant.created_or_updated',
  condition: async (event) => {
    const { enfantId } = event.payload as EnfantPayload
    const existing = await db.evenements
      .where('type').equals('anniversaire')
      .filter(e => e.personnesAssociees?.includes(enfantId) ?? false)
      .first()
    return !existing
  },
  action: async (event) => {
    const { enfantId, dateNaissance } = event.payload as EnfantPayload
    const deviceId = await getDeviceId()
    const membre = await db.membres.get(enfantId)
    if (!membre) return

    const dateAnniversaire = new Date(dateNaissance)
    const currentYear = new Date().getFullYear()
    dateAnniversaire.setFullYear(currentYear)

    await db.evenements.add({
      id: uuid(),
      titre: `Anniversaire de ${membre.prenom}`,
      type: 'anniversaire',
      dateDebut: dateAnniversaire,
      journeeEntiere: true,
      recurrence: true,
      frequence: 'annuelle',
      personnesAssociees: [enfantId],
      contexteMedical: false,
      archive: false,
      ...withAudit({}),
      deviceId,
    })
  },
  enabled: true,
})

// A-12 — Mise à jour du statut d'une activité après réalisation
automationEngine.register({
  id: 'A-12',
  name: 'Mise à jour du statut d\'une activité après réalisation',
  trigger: 'planification.status_changed',
  condition: async (event) => {
    const { statut } = event.payload as PlanificationChangedPayload
    return statut === 'realisee'
  },
  action: async (event) => {
    const { planificationId } = event.payload as PlanificationChangedPayload
    const planification = await db.planificationsActivites.get(planificationId)
    if (!planification) return

    const activite = await db.activites.get(planification.activite)
    if (!activite) return

    if (activite.statutBibliotheque === 'a_faire' || activite.statutBibliotheque === 'demarrer') {
      await db.activites.update(activite.id, {
        statutBibliotheque: 'realise',
        updatedAt: new Date(),
      })
    }

    await db.planificationsActivites.update(planificationId, {
      updatedAt: new Date(),
    })
  },
  enabled: true,
})

// ─────────────────────────────────────────────────────────────────────────────
// MODULE MAISON
// ─────────────────────────────────────────────────────────────────────────────

// A-13 — Dégradation automatique du score de propreté
automationEngine.register({
  id: 'A-13',
  name: 'Dégradation automatique du score de propreté d\'une pièce',
  trigger: 'day.passed',
  condition: async () => true,
  action: async () => {
    const pieces = await db.pieces.where('actif').equals(1).toArray()

    for (const piece of pieces) {
      const taux = piece.tauxDegradation ?? 0
      if (taux === 0) continue

      const dernierEntretien = piece.dernierEntretien
      const maintenant = new Date()
      const joursSans = dernierEntretien
        ? Math.floor((maintenant.getTime() - new Date(dernierEntretien).getTime()) / 86400000)
        : 0

      if (joursSans < 1) continue

      const newScore = Math.max(0, piece.scoreProprety - taux)
      const etatGeneral: Piece['etatGeneral'] =
        newScore >= 80 ? 'tres_propre' :
        newScore >= 50 ? 'propre' :
        newScore >= 20 ? 'a_entretenir' : 'urgent'

      await db.pieces.update(piece.id, {
        scoreProprety: newScore,
        etatGeneral,
        updatedAt: new Date(),
      })
    }
  },
  enabled: true,
})

// A-14 — Mise à jour du score de propreté après une mission ménage
automationEngine.register({
  id: 'A-14',
  name: 'Mise à jour du score de propreté après une mission ménage',
  trigger: 'tache.menage_completed',
  condition: async (event) => {
    const { tache } = event.payload as TacheMenagePayload
    return !!tache.pieceAssociee && tache.moduleOrigine === 'maison'
  },
  action: async (event) => {
    const { tache } = event.payload as TacheMenagePayload
    if (!tache.pieceAssociee) return

    const piece = await db.pieces.get(tache.pieceAssociee)
    if (!piece) return

    // Calcul de l'incrément selon durée et difficulté
    const duree = tache.dureeEstimee ?? 30
    const increment = Math.min(30, Math.floor(duree / 10) * 5 + 5)
    const newScore = Math.min(100, piece.scoreProprety + increment)

    const etatGeneral: Piece['etatGeneral'] =
      newScore >= 80 ? 'tres_propre' :
      newScore >= 50 ? 'propre' :
      newScore >= 20 ? 'a_entretenir' : 'urgent'

    await db.pieces.update(piece.id, {
      scoreProprety: newScore,
      etatGeneral,
      dernierEntretien: new Date(),
      updatedAt: new Date(),
    })
  },
  enabled: true,
})

// A-15 — Calcul automatique de la progression d'un projet maison
automationEngine.register({
  id: 'A-15',
  name: 'Calcul automatique de la progression d\'un projet maison',
  trigger: 'tache.projet_status_changed',
  condition: async (event) => {
    const { tache } = event.payload as TacheProjetPayload
    return !!tache.projetAssocie
  },
  action: async (event) => {
    const { tache } = event.payload as TacheProjetPayload
    if (!tache.projetAssocie) return

    const taches = await db.taches
      .where('projetAssocie').equals(tache.projetAssocie)
      .filter(t => !t.archive)
      .toArray()

    if (taches.length === 0) return

    const faites = taches.filter(t => t.statut === 'fait').length
    const progression = Math.round((faites / taches.length) * 100)

    await db.projetsMaison.update(tache.projetAssocie, {
      progression,
      updatedAt: new Date(),
    })
  },
  enabled: true,
})

// A-17 — Passage automatique du statut projet à "en_cours"
automationEngine.register({
  id: 'A-17',
  name: 'Passage automatique du statut projet à en_cours',
  trigger: 'tache.projet_status_changed',
  condition: async (event) => {
    const { tache } = event.payload as TacheProjetPayload
    if (!tache.projetAssocie) return false
    const projet = await db.projetsMaison.get(tache.projetAssocie)
    return projet?.statut === 'a_faire' &&
      (tache.statut === 'en_cours' || tache.statut === 'fait')
  },
  action: async (event) => {
    const { tache } = event.payload as TacheProjetPayload
    if (!tache.projetAssocie) return

    const projet = await db.projetsMaison.get(tache.projetAssocie)
    if (!projet || projet.dateDebut) return // dateDebut déjà renseigné

    await db.projetsMaison.update(tache.projetAssocie, {
      statut: 'en_cours',
      dateDebut: new Date().toISOString().split('T')[0],
      updatedAt: new Date(),
    })
  },
  enabled: true,
})

// A-18 — Passage automatique du statut projet à "terminé"
automationEngine.register({
  id: 'A-18',
  name: 'Passage automatique du statut projet à terminé',
  trigger: 'tache.projet_status_changed',
  condition: async (event) => {
    const { tache } = event.payload as TacheProjetPayload
    if (!tache.projetAssocie) return false

    const taches = await db.taches
      .where('projetAssocie').equals(tache.projetAssocie)
      .filter(t => !t.archive)
      .toArray()

    return taches.length > 0 && taches.every(t => t.statut === 'fait')
  },
  action: async (event) => {
    const { tache } = event.payload as TacheProjetPayload
    if (!tache.projetAssocie) return

    await db.projetsMaison.update(tache.projetAssocie, {
      statut: 'termine',
      progression: 100,
      updatedAt: new Date(),
    })

    // Déclenche A-16 via l'engine
    const projet = await db.projetsMaison.get(tache.projetAssocie)
    if (projet) {
      // A-16 sera déclenché par la règle projet.completed
      await automationEngine.emit({
        type: 'projet.completed',
        payload: { projet },
        timestamp: new Date(),
      })
    }
  },
  enabled: true,
})

// A-16 — Affichage de la wishlist d'une pièce après fin de projet
automationEngine.register({
  id: 'A-16',
  name: 'Affichage de la wishlist d\'une pièce après fin de projet',
  trigger: 'projet.completed',
  condition: async (event) => {
    const { projet } = event.payload as ProjetPayload
    if (!projet.pieceAssociee) return false
    const items = await db.wishlistItems
      .where('pieceAssociee').equals(projet.pieceAssociee)
      .filter(item => item.statut === 'a_decider' || item.statut === 'approuve')
      .count()
    return items > 0
  },
  action: async (event) => {
    const { projet } = event.payload as ProjetPayload
    useNotificationsStore.getState().addToast({
      type: 'info',
      message: `Projet terminé — des articles wishlist sont disponibles pour cette pièce.`,
      duration: 4000,
    })
  },
  enabled: true,
})

// ─────────────────────────────────────────────────────────────────────────────
// MODULE FAMILLE & BUDGET
// ─────────────────────────────────────────────────────────────────────────────

// A-21 — Enregistrement de l'humeur dans l'historique émotionnel
// (géré directement dans le service Humeur — l'emit déclenche le refresh Dashboard)

// A-22 — Liaison des humeurs saisies pendant une réunion famille
automationEngine.register({
  id: 'A-22',
  name: 'Liaison des humeurs saisies pendant une réunion famille',
  trigger: 'reunion.closed',
  condition: async () => true,
  action: async (event) => {
    const { reunionId, dateDebut } = event.payload as { reunionId: string; dateDebut: string }
    const humeurs = await db.humeurs
      .where('date').equals(dateDebut)
      .filter(h => h.source === 'reunion_famille')
      .toArray()

    await db.reunionsFamille.update(reunionId, {
      humeursSaisies: humeurs.map(h => h.id),
      terminee: true,
      updatedAt: new Date(),
    })
  },
  enabled: true,
})

// A-23 — Création automatique d'une transaction lors d'un achat wishlist
automationEngine.register({
  id: 'A-23',
  name: 'Création automatique d\'une transaction lors d\'un achat wishlist',
  trigger: 'wishlist_item.status_changed',
  condition: async (event) => {
    const { item } = event.payload as WishlistItemChangedPayload
    return item.statut === 'achete' && !!item.prix && !!item.enveloppeAssociee
  },
  action: async (event) => {
    const { item } = event.payload as WishlistItemChangedPayload
    const deviceId = await getDeviceId()

    const transaction: Transaction = {
      id: uuid(),
      montant: item.prix!,
      type: 'depense',
      libelle: item.nom,
      enveloppeAssociee: item.enveloppeAssociee!,
      achatAssocie: item.id,
      date: new Date().toISOString().split('T')[0],
      source: 'automatique',
      archive: false,
      ...withAudit({}),
      deviceId,
    }
    await db.transactions.add(transaction)

    // Déclencher A-24
    await automationEngine.emit({
      type: 'transaction.created_or_modified',
      payload: { transaction },
      timestamp: new Date(),
    })
  },
  enabled: true,
})

// A-24 — Recalcul des montants d'une enveloppe budgétaire
automationEngine.register({
  id: 'A-24',
  name: 'Recalcul des montants d\'une enveloppe budgétaire',
  trigger: 'transaction.created_or_modified',
  condition: async () => true,
  action: async (event) => {
    const { transaction } = event.payload as TransactionPayload

    const transactions = await db.transactions
      .where('enveloppeAssociee').equals(transaction.enveloppeAssociee)
      .filter(t => !t.archive && t.type === 'depense')
      .toArray()

    const montantDepense = transactions.reduce((sum, t) => sum + t.montant, 0)
    const enveloppe = await db.enveloppes.get(transaction.enveloppeAssociee)
    if (!enveloppe) return

    const montantRestant = enveloppe.montantPrevu - montantDepense

    await db.enveloppes.update(enveloppe.id, {
      montantDepense,
      montantRestant,
      updatedAt: new Date(),
    })

    // Déclencher A-25 si seuil dépassé
    if (enveloppe.alerteSeuil) {
      const ratio = (montantDepense / enveloppe.montantPrevu) * 100
      if (ratio >= enveloppe.alerteSeuil) {
        await automationEngine.emit({
          type: 'enveloppe.threshold_exceeded',
          payload: { enveloppe: { ...enveloppe, montantDepense, montantRestant } },
          timestamp: new Date(),
        })
      }
    }
  },
  enabled: true,
})

// A-25 — Alerte de dépassement de budget
automationEngine.register({
  id: 'A-25',
  name: 'Alerte de dépassement de budget',
  trigger: 'enveloppe.threshold_exceeded',
  condition: async () => true,
  action: async (event) => {
    const { enveloppe } = event.payload as EnveloppePayload
    const montantDepense = (enveloppe as unknown as Record<string, number>)['montantDepense'] ?? 0
    const montantRestant = (enveloppe as unknown as Record<string, number>)['montantRestant'] ?? 0
    const ratio = Math.round((montantDepense / enveloppe.montantPrevu) * 100)
    useNotificationsStore.getState().addToast({
      type: 'warning',
      message: `Budget "${enveloppe.nom}" à ${ratio}% — ${montantRestant.toFixed(0)} € restants.`,
      duration: 6000,
    })
  },
  enabled: true,
})

// ─────────────────────────────────────────────────────────────────────────────
// TÂCHES TRANSVERSALES
// ─────────────────────────────────────────────────────────────────────────────

// A-29 — Génération d'une tâche récurrente au nouveau cycle
automationEngine.register({
  id: 'A-29',
  name: 'Génération d\'une tâche récurrente au nouveau cycle',
  trigger: 'tache.completed_recurrent',
  condition: async (event) => {
    const { tache } = event.payload as TacheCompletedPayload
    return tache.recurrence === true && !!tache.frequence
  },
  action: async (event) => {
    const { tache } = event.payload as TacheCompletedPayload
    const completeLe = new Date()
    let nextDate = new Date()

    switch (tache.frequence) {
      case 'quotidienne': nextDate.setDate(nextDate.getDate() + 1); break
      case 'hebdomadaire': nextDate.setDate(nextDate.getDate() + 7); break
      case 'mensuelle': nextDate.setMonth(nextDate.getMonth() + 1); break
      default: return
    }

    await db.taches.update(tache.id, {
      statut: 'a_faire',
      dateEcheance: nextDate,
      completeeLe: completeLe,
      updatedAt: new Date(),
    })
  },
  enabled: true,
})

// A-30 — Archivage des tâches complétées sans récurrence
automationEngine.register({
  id: 'A-30',
  name: 'Archivage des tâches complétées sans récurrence',
  trigger: 'tache.completed_nonrecurrent',
  condition: async (event) => {
    const { tache } = event.payload as TacheCompletedPayload
    return !tache.recurrence
  },
  action: async (event) => {
    const { tache } = event.payload as TacheCompletedPayload
    // Planifier l'archivage à J+7
    const archiveDate = new Date()
    archiveDate.setDate(archiveDate.getDate() + 7)

    // Stocker la date d'archivage planifié dans deletedAt
    await db.taches.update(tache.id, {
      deletedAt: archiveDate,
      updatedAt: new Date(),
    })
  },
  enabled: true,
})

// A-34 — Indexation automatique des entités dans la recherche globale
automationEngine.register({
  id: 'A-34',
  name: 'Indexation automatique des entités dans la recherche globale',
  trigger: 'entity.created_or_modified',
  condition: async (event) => {
    const { data } = event.payload as EntityPayload
    return !data['archive']
  },
  action: async (event) => {
    // L'index de recherche est géré par le SearchService
    // qui écoute les changements Dexie en temps réel
    const { entityId, tableName } = event.payload as EntityPayload
    console.log(`[A-34] Indexation: ${tableName}#${entityId}`)
  },
  enabled: true,
})

// A-35 — Désindexation d'une entité archivée
automationEngine.register({
  id: 'A-35',
  name: 'Désindexation d\'une entité archivée',
  trigger: 'entity.archived',
  condition: async () => true,
  action: async (event) => {
    const { entityId, tableName } = event.payload as EntityPayload
    console.log(`[A-35] Désindexation: ${tableName}#${entityId}`)
  },
  enabled: true,
})

// A-36 — Horodatage et identification de l'appareil source
// (intégré dans tous les services via withAudit() + withDevice())

// A-39 — Soft delete universel
automationEngine.register({
  id: 'A-39',
  name: 'Soft delete universel',
  trigger: 'entity.deleted',
  condition: async () => true,
  action: async (event) => {
    const { entityId, tableName } = event.payload as EntityPayload
    const table = (db as unknown as Record<string, { update: (id: string, changes: object) => Promise<number> }>)[tableName]
    if (!table) return

    await table.update(entityId, {
      archive: true,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
  },
  enabled: true,
})

// A-41 — Propagation d'un changement de catégorie ou statut personnalisé
automationEngine.register({
  id: 'A-41',
  name: 'Propagation d\'un changement de catégorie ou statut personnalisé',
  trigger: 'category_or_status.renamed',
  condition: async () => true,
  action: async (event) => {
    const { tableName, field, oldValue, newValue } = event.payload as CategoryRenamedPayload
    console.log(`[A-41] Propagation: ${tableName}.${field} "${oldValue}" → "${newValue}"`)
    // La propagation réelle est effectuée table par table dans le ParametresService
  },
  enabled: true,
})

// A-42 — Initialisation de la base au premier lancement
// (géré par seed.ts — appelé dans main.tsx au premier chargement)

// ─────────────────────────────────────────────────────────────────────────────
// F4 — SUGGESTIONS INTELLIGENTES
// Principe : âge de l'enfant + saison + événements + cycles d'achat détectés
// Aucun inventaire, aucune saisie de taille ou poids requise.
// ─────────────────────────────────────────────────────────────────────────────

function getMoisActuel(): number { return new Date().getMonth() } // 0=jan

/** Âge en années à partir d'une dateNaissance "YYYY-MM-DD" */
function ageEnAnnees(dateNaissance: string): number {
  const naissance = new Date(dateNaissance)
  const aujourd = new Date()
  let age = aujourd.getFullYear() - naissance.getFullYear()
  const m = aujourd.getMonth() - naissance.getMonth()
  if (m < 0 || (m === 0 && aujourd.getDate() < naissance.getDate())) age--
  return age
}

/** Âge en mois — utile pour les tout-petits (couches, biberons…) */
function ageEnMois(dateNaissance: string): number {
  const n = new Date(dateNaissance)
  const a = new Date()
  return (a.getFullYear() - n.getFullYear()) * 12 + (a.getMonth() - n.getMonth())
}

/** Vérifie qu'une pensée similaire n'existe pas déjà en cours */
async function penseeExisteDeja(motsCles: string[]): Promise<boolean> {
  const pensees = await db.pensees
    .filter(p => !p.archive && !p.deletedAt && p.statut === 'active')
    .toArray()
  return pensees.some(p =>
    motsCles.some(m => p.contenu.toLowerCase().includes(m.toLowerCase()))
  )
}

/** Crée une pensée-suggestion dans le tableau des oublis */
async function creerSuggestion(
  contenu: string,
  categorie: import('@shared/types').CategoriePensee,
  opts?: { dateDetectee?: string; actionSuggeree?: string }
) {
  const deviceId = await getDeviceId()
  await db.pensees.add({
    id: uuid(),
    contenu,
    categorie,
    actionSuggeree: opts?.actionSuggeree ?? 'Vérifier',
    dateDetectee: opts?.dateDetectee,
    statut: 'active',
    archive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deviceId,
  })
}

// ─── S-01 — Vêtements & chaussures selon âge + saison ────────────────────────
// Logique : les enfants grandissent vite → suggestions saisonnières ciblées
automationEngine.register({
  id: 'S-01',
  name: 'Suggestions vêtements/chaussures selon âge et saison',
  trigger: 'dashboard.opened',
  condition: async () => {
    const enfants = await db.enfants.filter(e => !e.deletedAt).toArray()
    return enfants.length > 0
  },
  action: async () => {
    const enfants = await db.enfants.filter(e => !e.deletedAt).toArray()
    const membres = await db.membres.filter(m => !m.deletedAt).toArray()
    const mois = getMoisActuel()

    for (const enfant of enfants) {
      const membre = membres.find(m => m.id === enfant.id)
      const prenom = membre?.prenom ?? 'l\'enfant'
      const age = ageEnAnnees(enfant.dateNaissance)
      const ageMois = ageEnMois(enfant.dateNaissance)

      // ── Avant la rentrée (juillet-août) ──────────────────────────────────
      if (mois === 6 || mois === 7) {
        if (age >= 3 && !(await penseeExisteDeja([prenom, 'rentrée', 'fournitures']))) {
          await creerSuggestion(
            `Rentrée scolaire de ${prenom} — vérifier les fournitures, vêtements et chaussures`,
            'enfants',
            { actionSuggeree: 'Préparer' }
          )
        }
      }

      // ── Avant l'hiver (sept-oct) — vêtements chauds ──────────────────────
      if (mois === 8 || mois === 9) {
        if (!(await penseeExisteDeja([prenom, 'hiver', 'manteau']))) {
          const msg = age < 3
            ? `Vérifier les vêtements chauds de ${prenom} — manteau, pyjama chaud, chaussons pour cet hiver`
            : `Vérifier le manteau et les bottes de ${prenom} pour l'hiver — taille correcte ?`
          await creerSuggestion(msg, 'enfants')
        }
      }

      // ── Avant l'été (avr-mai) — vêtements légers ─────────────────────────
      if (mois === 3 || mois === 4) {
        if (!(await penseeExisteDeja([prenom, 'été', 'léger']))) {
          await creerSuggestion(
            `Vérifier les vêtements d'été de ${prenom} — tailles encore bonnes ? Maillot, sandales ?`,
            'enfants'
          )
        }
      }

      // ── Chaussures toutes les 2-3 saisons (enfant < 12 ans) ───────────────
      // Fenêtre : janvier et juin (début de saison)
      if ((mois === 0 || mois === 5) && age < 12) {
        if (!(await penseeExisteDeja([prenom, 'chaussures', 'pointure']))) {
          await creerSuggestion(
            `Vérifier les chaussures de ${prenom} — pointure encore bonne ?`,
            'enfants'
          )
        }
      }

      // ── Pyjamas chauds (oct) ─────────────────────────────────────────────
      if (mois === 9 && !(await penseeExisteDeja([prenom, 'pyjama']))) {
        await creerSuggestion(
          `Vérifier les pyjamas chauds de ${prenom} pour l'hiver`,
          'enfants'
        )
      }

      // ── Tout-petit < 18 mois : vêtements changent très vite ───────────────
      if (ageMois < 18 && ageMois % 3 === 0) {
        if (!(await penseeExisteDeja([prenom, 'taille', 'bébé']))) {
          await creerSuggestion(
            `${prenom} a ${ageMois} mois — vérifier si les vêtements sont encore à la bonne taille`,
            'enfants'
          )
        }
      }
    }
  },
  enabled: true,
})

// ─── S-02 — Antiparasitaire animaux (saisons à risque) ───────────────────────
automationEngine.register({
  id: 'S-02',
  name: 'Suggérer antiparasitaire animaux',
  trigger: 'dashboard.opened',
  condition: async () => {
    const mois = getMoisActuel()
    if (![2, 3, 4, 8].includes(mois)) return false // mars-mai + sept
    return !(await penseeExisteDeja(['antiparasitaire', 'vermifuge', 'puce']))
  },
  action: async () => {
    await creerSuggestion('Antiparasitaire animaux — est-ce à jour ?', 'animaux')
  },
  enabled: true,
})

// ─── S-03 — Suggestions contextuelles à partir des événements ────────────────
// F3 : quand un événement est créé, l'app suggère les tâches associées
automationEngine.register({
  id: 'S-03',
  name: 'Suggestions contextuelles à partir d\'un événement',
  trigger: 'entity.created_or_modified',
  condition: async (event) => {
    const { tableName } = event.payload as EntityPayload
    return tableName === 'evenements'
  },
  action: async (event) => {
    const { entityId } = event.payload as EntityPayload
    const evenement = await db.evenements.get(entityId)
    if (!evenement || evenement.archive) return

    const titre = evenement.titre.toLowerCase()
    const deviceId = await getDeviceId()
    const dateStr = new Date(evenement.dateDebut).toISOString().split('T')[0]
    const dateLabel = new Date(evenement.dateDebut).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })

    const suggestions: { cond: boolean; contenu: string; cat: import('@shared/types').CategoriePensee }[] = [
      // Anniversaire
      { cond: titre.includes('anniversaire'),
        contenu: `Cadeau pour "${evenement.titre}" — ${dateLabel}`, cat: 'achats' },
      { cond: titre.includes('anniversaire'),
        contenu: `Note l'adresse pour "${evenement.titre}"`, cat: 'evenements' },
      // Vétérinaire
      { cond: titre.includes('vét') || titre.includes('veterinaire'),
        contenu: `Carnet de santé à préparer pour le rendez-vous vétérinaire`, cat: 'animaux' },
      { cond: titre.includes('vét') || titre.includes('veterinaire'),
        contenu: `Prévoir le transport pour le vétérinaire`, cat: 'animaux' },
      // Médecin
      { cond: titre.includes('médecin') || titre.includes('medecin') || evenement.contexteMedical,
        contenu: `Documents médicaux à préparer pour "${evenement.titre}"`, cat: 'sante' },
      // Rentrée
      { cond: titre.includes('rentré') || titre.includes('rentree'),
        contenu: `Liste fournitures scolaires pour la rentrée`, cat: 'enfants' },
      { cond: titre.includes('rentré') || titre.includes('rentree'),
        contenu: `Vêtements et chaussures pour la rentrée — faire le point`, cat: 'enfants' },
      // Vacances / voyage
      { cond: titre.includes('vacances') || titre.includes('voyage'),
        contenu: `Préparer les valises pour "${evenement.titre}"`, cat: 'evenements' },
      { cond: titre.includes('vacances') || titre.includes('voyage'),
        contenu: `Vérifier les documents d'identité pour le voyage`, cat: 'administratif' },
      // Visite / invités
      { cond: titre.includes('visite') || titre.includes('invités') || titre.includes('invites'),
        contenu: `Préparatifs maison pour "${evenement.titre}"`, cat: 'maison' },
    ]

    for (const s of suggestions) {
      if (!s.cond) continue
      const cles = [s.contenu.split(' ').slice(0, 4).join(' ')]
      if (await penseeExisteDeja(cles)) continue
      await db.pensees.add({
        id: uuid(),
        contenu: s.contenu,
        categorie: s.cat,
        dateDetectee: dateStr,
        actionSuggeree: 'Préparer',
        statut: 'active',
        archive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deviceId,
      })
    }
  },
  enabled: true,
})

// ─── S-04 — Détection de cycles d'achat récurrents ───────────────────────────
// Principe : si le même produit est coché (= acheté) plusieurs fois avec
// un intervalle régulier, l'app mémorise le cycle et rappelle avant épuisement.
// Exemples : couches, lait infantile, produits ménagers, nourriture animaux…
automationEngine.register({
  id: 'S-04',
  name: 'Détection cycles d\'achat récurrents',
  trigger: 'courses_item.checked',
  condition: () => true,
  action: async (event) => {
    const { coursesItem } = event.payload as CoursesItemCheckedPayload
    if (!coursesItem.produit) return

    const deviceId = await getDeviceId()

    // Récupérer l'historique des achats du même produit (items cochés)
    const historique = await db.coursesItems
      .where('produit').equals(coursesItem.produit)
      .filter(i => i.coche && !i.deletedAt)
      .toArray()
      .then(list => list
        .filter(i => i.dateAjout)
        .sort((a, b) => new Date(a.dateAjout).getTime() - new Date(b.dateAjout).getTime())
      )

    // Il faut au moins 2 achats pour détecter un cycle
    if (historique.length < 2) return

    // Calculer les intervalles entre achats consécutifs
    const intervalles: number[] = []
    for (let i = 1; i < historique.length; i++) {
      const diff = Math.round(
        (new Date(historique[i].dateAjout).getTime() - new Date(historique[i - 1].dateAjout).getTime())
        / (1000 * 60 * 60 * 24)
      )
      if (diff > 0 && diff < 180) intervalles.push(diff) // ignorer les anomalies > 6 mois
    }

    if (intervalles.length === 0) return

    // Moyenne des intervalles (cycle estimé)
    const cycleMoyen = Math.round(intervalles.reduce((a, b) => a + b, 0) / intervalles.length)

    // Vérifier la régularité : écart-type < 40% de la moyenne
    const ecartType = Math.sqrt(
      intervalles.reduce((acc, v) => acc + Math.pow(v - cycleMoyen, 2), 0) / intervalles.length
    )
    if (ecartType / cycleMoyen > 0.4) return // cycle trop irrégulier, pas de suggestion

    // Date du prochain achat estimé
    const dernierAchat = new Date(historique[historique.length - 1].dateAjout)
    const prochainAchat = new Date(dernierAchat)
    prochainAchat.setDate(prochainAchat.getDate() + cycleMoyen)

    // Rappel 3 jours avant (ou dès maintenant si on est dans les 3 jours)
    const rappelLe = new Date(prochainAchat)
    rappelLe.setDate(rappelLe.getDate() - 3)

    const aujourd = new Date()
    if (rappelLe > aujourd) return // pas encore l'heure du rappel

    // Récupérer le nom du produit
    const produit = await db.produits.get(coursesItem.produit)
    if (!produit) return

    const cleSuivi = `cycle_${coursesItem.produit}`
    if (await penseeExisteDeja([produit.nom, 'cycle', cleSuivi])) return

    // Formuler le message selon le cycle
    const cycleLabel = cycleMoyen <= 7
      ? `toutes les semaines`
      : cycleMoyen <= 10
        ? `tous les ~${cycleMoyen} jours`
        : cycleMoyen <= 16
          ? `toutes les 2 semaines`
          : cycleMoyen <= 25
            ? `toutes les ~3 semaines`
            : `tous les ~${Math.round(cycleMoyen / 7)} semaines`

    await db.pensees.add({
      id: uuid(),
      contenu: `${produit.nom} — tu en achètes ${cycleLabel}, il serait temps de le rajouter aux courses`,
      categorie: 'achats',
      actionSuggeree: 'Ajouter aux courses',
      dateDetectee: prochainAchat.toISOString().split('T')[0],
      statut: 'active',
      archive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deviceId,
    })
  },
  enabled: true,
})

// ─── S-05 — Rappel cycle achat au démarrage du dashboard ─────────────────────
// Vérifie les cycles connus sans attendre qu'un item soit coché
automationEngine.register({
  id: 'S-05',
  name: 'Rappels cycles d\'achat au chargement',
  trigger: 'dashboard.opened',
  condition: () => true,
  action: async () => {
    const deviceId = await getDeviceId()

    // Récupérer tous les produits qui ont été achetés au moins 3 fois
    const tousItems = await db.coursesItems
      .filter(i => i.coche && !i.deletedAt && !!i.produit)
      .toArray()

    // Grouper par produit
    const parProduit: Record<string, typeof tousItems> = {}
    for (const item of tousItems) {
      if (!item.produit) continue
      if (!parProduit[item.produit]) parProduit[item.produit] = []
      parProduit[item.produit].push(item)
    }

    for (const [produitId, items] of Object.entries(parProduit)) {
      if (items.length < 3) continue // pas assez d'historique

      const tries = items
        .filter(i => i.dateAjout)
        .sort((a, b) => new Date(a.dateAjout).getTime() - new Date(b.dateAjout).getTime())

      const intervalles: number[] = []
      for (let i = 1; i < tries.length; i++) {
        const diff = Math.round(
          (new Date(tries[i].dateAjout).getTime() - new Date(tries[i - 1].dateAjout).getTime())
          / (1000 * 60 * 60 * 24)
        )
        if (diff > 0 && diff < 180) intervalles.push(diff)
      }
      if (intervalles.length < 2) continue

      const cycleMoyen = Math.round(intervalles.reduce((a, b) => a + b, 0) / intervalles.length)
      const ecartType = Math.sqrt(
        intervalles.reduce((acc, v) => acc + Math.pow(v - cycleMoyen, 2), 0) / intervalles.length
      )
      if (ecartType / cycleMoyen > 0.4) continue // cycle irrégulier

      const dernierAchat = new Date(tries[tries.length - 1].dateAjout)
      const prochainAchat = new Date(dernierAchat)
      prochainAchat.setDate(prochainAchat.getDate() + cycleMoyen)

      const rappelLe = new Date(prochainAchat)
      rappelLe.setDate(rappelLe.getDate() - 3)

      if (rappelLe > new Date()) continue

      const produit = await db.produits.get(produitId)
      if (!produit) continue

      if (await penseeExisteDeja([produit.nom, 'cours'])) continue

      // Vérifier si déjà dans les courses
      const dejaDansCourses = await db.coursesItems
        .filter(i => !i.archive && !i.deletedAt && !i.coche && i.produit === produitId)
        .first()
      if (dejaDansCourses) continue

      const cycleLabel = cycleMoyen <= 7 ? 'chaque semaine'
        : cycleMoyen <= 16 ? 'toutes les 2 semaines'
        : `tous les ${Math.round(cycleMoyen / 7)} semaines`

      await db.pensees.add({
        id: uuid(),
        contenu: `${produit.nom} — tu en rachètes ${cycleLabel}. Prochain achat estimé : ${prochainAchat.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
        categorie: 'achats',
        actionSuggeree: 'Ajouter aux courses',
        dateDetectee: prochainAchat.toISOString().split('T')[0],
        statut: 'active',
        archive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deviceId,
      })
    }
  },
  enabled: true,
})

// ─────────────────────────────────────────────────────────────────────────────
// A-20 — Wishlist consommable approuvée → ajout automatique aux courses
// Déclencheur : wishlist_item.status_changed
// Condition   : statut = 'approuve' ET contexte = 'achats_besoins'
// Action      : créer un CoursesItem (si pas déjà présent)
// ─────────────────────────────────────────────────────────────────────────────
automationEngine.register({
  id: 'A-20',
  name: 'Ajout automatique aux courses quand un besoin est approuvé',
  trigger: 'wishlist_item.status_changed',
  condition: async (event) => {
    const { item } = event.payload as WishlistItemChangedPayload
    return item.statut === 'approuve' && item.contexte === 'achats_besoins'
  },
  action: async (event) => {
    const { item } = event.payload as WishlistItemChangedPayload
    const deviceId = await getDeviceId()

    // Éviter les doublons : vérifier si déjà en courses (non coché, non archivé)
    const dejaPresent = await db.coursesItems
      .filter(c => !c.archive && !c.coche && (c.nom === item.nom))
      .first()
    if (dejaPresent) return

    const coursesItem: CoursesItem = {
      id: uuid(),
      produit: item.id,
      nom: item.nom,
      quantite: 1,
      coche: false,
      source: 'wishlist',
      dateAjout: new Date(),
      archive: false,
      ...withAudit({}),
      deviceId,
    }
    await db.coursesItems.add(coursesItem)

    useNotificationsStore.getState().addToast({
      type: 'success',
      message: `"${item.nom}" ajouté à ta liste de courses.`,
      duration: 3000,
    })
  },
  enabled: true,
})

// ─────────────────────────────────────────────────────────────────────────────
// A-40 — Archive en cascade lors d'une demande d'archivage maître
// Déclencheur : entity.master_archive_requested
// Payload     : { tableName, entityId }
// Action      : archive tous les enfants liés à l'entité
// ─────────────────────────────────────────────────────────────────────────────
interface MasterArchivePayload { tableName: string; entityId: string }

automationEngine.register({
  id: 'A-40',
  name: 'Archive en cascade des entités enfants',
  trigger: 'entity.master_archive_requested',
  condition: async () => true,
  action: async (event) => {
    const { tableName, entityId } = event.payload as MasterArchivePayload
    const now = new Date()
    const archiveFields = { archive: true, deletedAt: now, updatedAt: now }

    // Archivage selon le type d'entité parent
    switch (tableName) {

      case 'pieces': {
        // Tâches de la pièce
        const taches = await db.taches.where('pieceAssociee').equals(entityId).toArray()
        await Promise.all(taches.map(t => db.taches.update(t.id, archiveFields)))
        // Projets de la pièce
        const projets = await db.projetsMaison.where('pieceAssociee').equals(entityId).toArray()
        for (const projet of projets) {
          const tachesProjets = await db.taches.where('projetAssocie').equals(projet.id).toArray()
          await Promise.all(tachesProjets.map(t => db.taches.update(t.id, archiveFields)))
          await db.projetsMaison.update(projet.id, archiveFields)
        }
        // Wishlist items de la pièce
        const wishlist = await db.wishlistItems.where('pieceAssociee').equals(entityId).toArray()
        await Promise.all(wishlist.map(w => db.wishlistItems.update(w.id, archiveFields)))
        break
      }

      case 'projetsMaison': {
        // Tâches du projet
        const taches = await db.taches.where('projetAssocie').equals(entityId).toArray()
        await Promise.all(taches.map(t => db.taches.update(t.id, archiveFields)))
        break
      }

      case 'enveloppes': {
        // Transactions de l'enveloppe
        const transactions = await db.transactions.where('enveloppeAssociee').equals(entityId).toArray()
        await Promise.all(transactions.map(t => db.transactions.update(t.id, archiveFields)))
        // Wishlist items liés à l'enveloppe
        const wishlist = await db.wishlistItems.where('enveloppeAssociee').equals(entityId).toArray()
        await Promise.all(wishlist.map(w => db.wishlistItems.update(w.id, archiveFields)))
        break
      }

      case 'menus': {
        // Slots du menu (déjà géré par MenuService.archiveMenu, mais pour cohérence)
        const slots = await db.menuSlots.where('menu').equals(entityId).toArray()
        await Promise.all(slots.map(s => db.menuSlots.update(s.id, archiveFields)))
        break
      }
    }

    useNotificationsStore.getState().addToast({
      type: 'info',
      message: 'Archivage en cascade effectué.',
      duration: 2500,
    })
  },
  enabled: true,
})

// A-43 — Reset quotidien des tâches ménagères récurrentes
// Chaque matin au lancement, les tâches quotidiennes marquées "fait" la VEILLE
// sont remises à "a_faire" pour le nouveau jour.
automationEngine.register({
  id: 'A-43',
  name: 'Reset quotidien des tâches ménagères',
  trigger: 'day.passed',
  condition: async () => true,
  action: async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tachesQuotidiennes = await db.taches
      .filter(t =>
        !t.archive &&
        !t.deletedAt &&
        t.moduleOrigine === 'maison' &&
        t.frequence === 'quotidienne' &&
        t.recurrence === true &&
        t.statut === 'fait'
      )
      .toArray()

    // Remettre à zéro seulement si complétée avant aujourd'hui
    const aRemettre = tachesQuotidiennes.filter(t => {
      if (!t.completeeLe && !t.updatedAt) return true
      const completeLe = new Date(t.completeeLe ?? t.updatedAt)
      completeLe.setHours(0, 0, 0, 0)
      return completeLe.getTime() < today.getTime()
    })

    for (const t of aRemettre) {
      await db.taches.update(t.id, withUpdate({ statut: 'a_faire' as const }))
    }

    if (aRemettre.length > 0) {
      useNotificationsStore.getState().addToast({
        type: 'info',
        message: `${aRemettre.length} tâche${aRemettre.length > 1 ? 's' : ''} du ménage remise${aRemettre.length > 1 ? 's' : ''} à zéro pour aujourd'hui.`,
        duration: 3000,
      })
    }
  },
  enabled: true,
})

// ─────────────────────────────────────────────────────────────────────────────
// MODULE PROGRAMMES PÉDAGOGIQUES
// ─────────────────────────────────────────────────────────────────────────────

interface ActiviteProgrammeRealisedPayload {
  activite: ActiviteProgramme
  programmeId: string
  enfantsCibles: string[]
}

interface ImportRecetteValidatedPayload {
  recetteId: string
  recetteTitre: string
  nbIngredientsManquants: number
}

// A-44 — Créer une tâche préparation J-3 avant le début d'une semaine programme
automationEngine.register({
  id: 'A-44',
  name: 'Créer tâche préparation J-3 avant début de semaine programme',
  trigger: 'dashboard.opened',
  condition: async () => {
    const programmes = await db.programmesPedagogiques
      .where('statut').equals('actif')
      .filter(p => !p.archive)
      .toArray()
    return programmes.length > 0
  },
  action: async () => {
    const deviceId = await getDeviceId()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const j3 = new Date(today)
    j3.setDate(j3.getDate() + 3)

    const programmes = await db.programmesPedagogiques
      .where('statut').equals('actif')
      .filter(p => !p.archive)
      .toArray()

    for (const programme of programmes) {
      const debut = new Date(programme.dateDebut)
      debut.setHours(0, 0, 0, 0)

      for (const semaine of programme.semaines) {
        // Date de début de cette semaine
        const debutSemaine = new Date(debut)
        debutSemaine.setDate(debut.getDate() + (semaine.numero - 1) * 7)

        // On cherche les semaines qui démarrent dans 3 jours
        if (debutSemaine.getTime() !== j3.getTime()) continue

        for (const tacheProg of semaine.tachesPreparation) {
          if (tacheProg.faite) continue

          // Éviter les doublons : chercher une tâche avec ce titre et ce programme
          const existing = await db.taches
            .filter(t => !t.archive && !t.deletedAt && t.titre === tacheProg.titre && t.contexteLibre === programme.id)
            .first()
          if (existing) continue

          const tache: Tache = {
            id: uuid(),
            titre: tacheProg.titre,
            statut: 'a_faire',
            moduleOrigine: 'enfants',
            contexteLibre: programme.id,
            dureeEstimee: tacheProg.dureeEstimee,
            recurrence: false,
            archive: false,
            ...withAudit({}),
            deviceId,
          }
          await db.taches.add(tache)
        }

        useNotificationsStore.getState().addToast({
          type: 'info',
          message: `Semaine ${semaine.numero} de "${programme.titre}" démarre dans 3 jours — tâches de préparation créées.`,
          duration: 5000,
        })
      }
    }
  },
  enabled: true,
})

// A-45 — Mettre à jour le suivi des compétences après une activité programme réalisée
automationEngine.register({
  id: 'A-45',
  name: 'Mettre à jour suivi compétences après activité programme réalisée',
  trigger: 'activite_programme.realised',
  condition: async (event) => {
    const { activite } = event.payload as ActiviteProgrammeRealisedPayload
    return activite.competencesTravaillees.length > 0
  },
  action: async (event) => {
    const { activite, enfantsCibles } = event.payload as ActiviteProgrammeRealisedPayload
    const deviceId = await getDeviceId()

    for (const enfantId of enfantsCibles) {
      for (const competenceId of activite.competencesTravaillees) {
        // Chercher le suivi existant pour cet enfant + compétence
        const suivi = await db.competencesSuivi
          .filter(s => !s.archive && s.enfant === enfantId && s.competence === competenceId)
          .first()

        if (suivi) {
          // Passer de 'a_travailler' à 'en_cours' si c'est la première réalisation
          if (suivi.statut === 'a_travailler') {
            await db.competencesSuivi.update(suivi.id, {
              statut: 'en_cours' as const,
              dateDebut: new Date().toISOString().split('T')[0],
              updatedAt: new Date(),
            })
          }
        } else {
          // Créer un suivi si inexistant
          await db.competencesSuivi.add({
            id: uuid(),
            enfant: enfantId,
            competence: competenceId,
            statut: 'en_cours' as const,
            dateDebut: new Date().toISOString().split('T')[0],
            archive: false,
            ...withAudit({}),
            deviceId,
          })
        }
      }
    }
  },
  enabled: true,
})

// A-46 — Proposer de lier les ingrédients manquants aux courses après import recette
automationEngine.register({
  id: 'A-46',
  name: 'Proposer d\'ajouter les ingrédients manquants aux courses après import recette',
  trigger: 'import_recette.validated',
  condition: async (event) => {
    const { nbIngredientsManquants } = event.payload as ImportRecetteValidatedPayload
    return nbIngredientsManquants > 0
  },
  action: async (event) => {
    const { recetteTitre, nbIngredientsManquants } = event.payload as ImportRecetteValidatedPayload
    useNotificationsStore.getState().addToast({
      type: 'info',
      message: `"${recetteTitre}" importée — ${nbIngredientsManquants} ingrédient${nbIngredientsManquants > 1 ? 's' : ''} à ajouter aux courses ?`,
      duration: 6000,
    })
  },
  enabled: true,
})

console.log('[FamilyOS] Règles d\'automatisation + suggestions intelligentes enregistrées.')
