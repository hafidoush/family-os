import Dexie, { type Table } from 'dexie'
import type {
  Tache, Evenement, Produit, WishlistItem, Humeur, Note,
  Enveloppe, Transaction, Membre, Enfant, Activite,
  PlanificationActivite, Competence, CompetenceSuivi,
  ElementReligion, Recette, RecetteIngredient, Menu, MenuSlot,
  CoursesItem, Piece, ProjetMaison, Souvenir, ReunionFamille,
  SelfCareItem, SportSession, Tag, CategorieProduit,
  CategorieRecette, CategorieActivite, ParametreSync, ExportSnapshot,
  Pensee, Routine, RoutineItem, SessionPreparation,
  ProgrammePedagogique, ActiviteProgramme, ProgrammeAnnuel,
  ImportRecetteIA, ContactPartage, ListePartagee, EvenementDetail,
  SortiePersonnelle,
} from '@shared/types'

// ─── Version du schéma — incrémenter à chaque migration ──────────────────────
export const SCHEMA_VERSION = 14

// ─── Définition de la base ────────────────────────────────────────────────────
class FamilyOSDatabase extends Dexie {
  // Entités centrales
  taches!: Table<Tache, string>
  evenements!: Table<Evenement, string>
  produits!: Table<Produit, string>
  wishlistItems!: Table<WishlistItem, string>
  humeurs!: Table<Humeur, string>
  notes!: Table<Note, string>
  enveloppes!: Table<Enveloppe, string>
  transactions!: Table<Transaction, string>

  // Entités modules
  membres!: Table<Membre, string>
  enfants!: Table<Enfant, string>
  activites!: Table<Activite, string>
  planificationsActivites!: Table<PlanificationActivite, string>
  competences!: Table<Competence, string>
  competencesSuivi!: Table<CompetenceSuivi, string>
  elementsReligion!: Table<ElementReligion, string>
  recettes!: Table<Recette, string>
  recettesIngredients!: Table<RecetteIngredient, string>
  menus!: Table<Menu, string>
  menuSlots!: Table<MenuSlot, string>
  coursesItems!: Table<CoursesItem, string>
  pieces!: Table<Piece, string>
  projetsMaison!: Table<ProjetMaison, string>
  souvenirs!: Table<Souvenir, string>
  reunionsFamille!: Table<ReunionFamille, string>
  selfCareItems!: Table<SelfCareItem, string>
  sportSessions!: Table<SportSession, string>

  // F1/F2 — Pensées
  pensees!: Table<Pensee, string>

  // F6 — Routines adaptatives
  routines!: Table<Routine, string>
  routineItems!: Table<RoutineItem, string>

  // F8 — Sessions de préparation hebdomadaire
  sessionsPreparation!: Table<SessionPreparation, string>

  // IA Pédagogique — Programmes
  programmesPedagogiques!: Table<ProgrammePedagogique, string>
  activitesProgramme!: Table<ActiviteProgramme, string>
  programmesAnnuels!: Table<ProgrammeAnnuel, string>

  // IA Recettes — Import
  importsRecettesIA!: Table<ImportRecetteIA, string>

  // Partage Familial
  contactsPartage!: Table<ContactPartage, string>
  listesPartagees!: Table<ListePartagee, string>

  // Réceptions
  evenementsDetails!: Table<EvenementDetail, string>

  // Sorties personnalisées
  sortiesPersonnelles!: Table<SortiePersonnelle, string>

  // Entités de référence
  tags!: Table<Tag, string>
  categoriesProduits!: Table<CategorieProduit, string>
  categoriesRecettes!: Table<CategorieRecette, string>
  categoriesActivites!: Table<CategorieActivite, string>

  // Système
  parametresSync!: Table<ParametreSync, string>
  exportSnapshots!: Table<ExportSnapshot, string>

  constructor() {
    super('FamilyOS')

    // ─── Version 1 — schéma initial (conservé pour migration propre) ──────────
    this.version(1).stores({
      taches: 'id, statut, moduleOrigine, dateEcheance, pieceAssociee, enfantAssocie, parentTache, projetAssocie, archive, updatedAt, *tags',
      evenements: 'id, type, dateDebut, archive, updatedAt, *personnesAssociees',
      produits: 'id, nom, type, categorie, archive, updatedAt, *tags',
      wishlistItems: 'id, contexte, statut, pieceAssociee, enveloppeAssociee, archive, updatedAt',
      humeurs: 'id, membre, date, source, valeur, updatedAt',
      notes: 'id, contexte, enfantAssocie, pieceAssociee, archive, updatedAt, *tags',
      enveloppes: 'id, categorie, periode, archive, updatedAt',
      transactions: 'id, enveloppeAssociee, achatAssocie, type, date, archive, updatedAt',
      membres: 'id, role, actif, updatedAt',
      enfants: 'id, updatedAt',
      activites: 'id, categorie, difficulte, statutBibliotheque, archive, updatedAt, *competencesCiblees, *tags',
      planificationsActivites: 'id, activite, enfant, datePrevue, statut, updatedAt',
      competences: 'id, domaine, ordreSuggere, competenceSuivante, updatedAt',
      competencesSuivi: 'id, enfant, competence, statut, archive, updatedAt',
      elementsReligion: 'id, type, statut, enfantAssocie, archive, updatedAt',
      recettes: 'id, nom, categorie, favori, archive, updatedAt, *tags',
      recettesIngredients: 'id, recette, produit, updatedAt',
      menus: 'id, semaine, dateDebut, valide, archive, updatedAt',
      menuSlots: 'id, menu, jour, repas, recette, updatedAt',
      coursesItems: 'id, produit, coche, source, ajoutePar, updatedAt',
      pieces: 'id, nom, actif, etatGeneral, updatedAt',
      projetsMaison: 'id, pieceAssociee, statut, archive, updatedAt',
      souvenirs: 'id, date, type, archive, updatedAt, *membresAssocies, *tags',
      reunionsFamille: 'id, date, terminee, updatedAt, *humeursSaisies',
      selfCareItems: 'id, tache, type, remonteDashboard, updatedAt',
      sportSessions: 'id, membre, date, updatedAt',
      tags: 'id, libelle, moduleContexte, updatedAt',
      categoriesProduits: 'id, nom, typeProduit, ordre, updatedAt',
      categoriesRecettes: 'id, nom, ordre, updatedAt',
      categoriesActivites: 'id, nom, ordre, updatedAt',
      parametresSync: 'id, &cle, updatedAt',
      exportSnapshots: 'id, dateExport, updatedAt',
    })

    // ─── Version 4 — categorieIds sur Produit, elementId + membreId sur ElementReligion ──
    this.version(4).stores({
      // ── Entités centrales ────────────────────────────────────────────────
      // Syntaxe Dexie : premier champ = PK, les suivants = index
      taches: [
        'id',
        'statut',
        'moduleOrigine',
        'dateEcheance',
        'pieceAssociee',
        'enfantAssocie',
        'parentTache',
        'projetAssocie',
        'archive',
        'updatedAt',
        '*tags',       // Index multi-entrées pour tableau
      ].join(', '),

      evenements: [
        'id',
        'type',
        'dateDebut',
        'archive',
        'updatedAt',
        '*personnesAssociees',
      ].join(', '),

      produits: [
        'id',
        'nom',
        'type',
        'categorie',
        'archive',
        'updatedAt',
        '*tags',
        '*categorieIds',
      ].join(', '),

      wishlistItems: [
        'id',
        'contexte',
        'statut',
        'pieceAssociee',
        'enveloppeAssociee',
        'archive',
        'updatedAt',
      ].join(', '),

      humeurs: [
        'id',
        'membre',
        'date',
        'source',
        'valeur',
        'updatedAt',
      ].join(', '),

      notes: [
        'id',
        'contexte',
        'enfantAssocie',
        'pieceAssociee',
        'archive',
        'updatedAt',
        '*tags',
      ].join(', '),

      enveloppes: [
        'id',
        'categorie',
        'periode',
        'archive',
        'updatedAt',
      ].join(', '),

      transactions: [
        'id',
        'enveloppeAssociee',
        'achatAssocie',
        'type',
        'date',
        'archive',
        'updatedAt',
      ].join(', '),

      // ── Entités modules ──────────────────────────────────────────────────
      membres: [
        'id',
        'role',
        'actif',
        'updatedAt',
      ].join(', '),

      enfants: [
        'id',
        'membreId',
        'updatedAt',
      ].join(', '),

      activites: [
        'id',
        'categorie',
        'difficulte',
        'statutBibliotheque',
        'archive',
        'updatedAt',
        '*competencesCiblees',
        '*tags',
      ].join(', '),

      planificationsActivites: [
        'id',
        'activite',
        'enfant',
        'datePrevue',
        'statut',
        'updatedAt',
      ].join(', '),

      competences: [
        'id',
        'domaine',
        'ordreSuggere',
        'competenceSuivante',
        'updatedAt',
      ].join(', '),

      competencesSuivi: [
        'id',
        'enfant',
        'competence',
        'statut',
        'archive',
        'updatedAt',
      ].join(', '),

      elementsReligion: [
        'id',
        'elementId',
        'membreId',
        'type',
        'enfantAssocie',
        'archive',
        'updatedAt',
      ].join(', '),

      recettes: [
        'id',
        'nom',
        'categorie',
        'favori',
        'archive',
        'updatedAt',
        '*tags',
      ].join(', '),

      recettesIngredients: [
        'id',
        'recette',
        'produit',
        'updatedAt',
      ].join(', '),

      menus: [
        'id',
        'semaine',
        'dateDebut',
        'valide',
        'archive',
        'updatedAt',
      ].join(', '),

      menuSlots: [
        'id',
        'menu',
        'jour',
        'repas',
        'recette',
        'updatedAt',
      ].join(', '),

      coursesItems: [
        'id',
        'produit',
        'coche',
        'source',
        'ajoutePar',
        'updatedAt',
      ].join(', '),

      pieces: [
        'id',
        'nom',
        'actif',
        'etatGeneral',
        'updatedAt',
      ].join(', '),

      projetsMaison: [
        'id',
        'pieceAssociee',
        'statut',
        'archive',
        'updatedAt',
      ].join(', '),

      souvenirs: [
        'id',
        'date',
        'type',
        'archive',
        'updatedAt',
        '*membresAssocies',
        '*tags',
      ].join(', '),

      reunionsFamille: [
        'id',
        'date',
        'terminee',
        'updatedAt',
        '*humeursSaisies',
      ].join(', '),

      selfCareItems: [
        'id',
        'tache',
        'type',
        'remonteDashboard',
        'updatedAt',
      ].join(', '),

      sportSessions: [
        'id',
        'membre',
        'date',
        'updatedAt',
      ].join(', '),

      // ── Entités de référence ─────────────────────────────────────────────
      tags: [
        'id',
        'libelle',
        'moduleContexte',
        'updatedAt',
      ].join(', '),

      categoriesProduits: [
        'id',
        'nom',
        'typeProduit',
        'ordre',
        'updatedAt',
      ].join(', '),

      categoriesRecettes: [
        'id',
        'nom',
        'ordre',
        'updatedAt',
      ].join(', '),

      categoriesActivites: [
        'id',
        'nom',
        'ordre',
        'updatedAt',
      ].join(', '),

      // ── Système ──────────────────────────────────────────────────────────
      parametresSync: [
        'id',
        '&cle', // Index unique
        'updatedAt',
      ].join(', '),

      exportSnapshots: [
        'id',
        'dateExport',
        'updatedAt',
      ].join(', '),
    })

    // ─── Version 5 — Pensées, Routines, Croissance, Sessions préparation ──────
    this.version(5).stores({
      // Reprend toutes les tables v4 sans modification
      taches: 'id, statut, moduleOrigine, dateEcheance, pieceAssociee, enfantAssocie, parentTache, projetAssocie, archive, updatedAt, *tags',
      evenements: 'id, type, dateDebut, archive, updatedAt, *personnesAssociees',
      produits: 'id, nom, type, categorie, archive, updatedAt, *tags, *categorieIds',
      wishlistItems: 'id, contexte, statut, pieceAssociee, enveloppeAssociee, archive, updatedAt',
      humeurs: 'id, membre, date, source, valeur, updatedAt',
      notes: 'id, contexte, enfantAssocie, pieceAssociee, archive, updatedAt, *tags',
      enveloppes: 'id, categorie, periode, archive, updatedAt',
      transactions: 'id, enveloppeAssociee, achatAssocie, type, date, archive, updatedAt',
      membres: 'id, role, actif, updatedAt',
      enfants: 'id, membreId, updatedAt',
      activites: 'id, categorie, difficulte, statutBibliotheque, archive, updatedAt, *competencesCiblees, *tags',
      planificationsActivites: 'id, activite, enfant, datePrevue, statut, updatedAt',
      competences: 'id, domaine, ordreSuggere, competenceSuivante, updatedAt',
      competencesSuivi: 'id, enfant, competence, statut, archive, updatedAt',
      elementsReligion: 'id, elementId, membreId, type, enfantAssocie, archive, updatedAt',
      recettes: 'id, nom, categorie, favori, typePreparation, archive, updatedAt, *tags',
      recettesIngredients: 'id, recette, produit, updatedAt',
      menus: 'id, semaine, dateDebut, valide, archive, updatedAt',
      menuSlots: 'id, menu, jour, repas, recette, updatedAt',
      coursesItems: 'id, produit, coche, source, ajoutePar, updatedAt',
      pieces: 'id, nom, actif, etatGeneral, updatedAt',
      projetsMaison: 'id, pieceAssociee, statut, archive, updatedAt',
      souvenirs: 'id, date, type, archive, updatedAt, *membresAssocies, *tags',
      reunionsFamille: 'id, date, terminee, updatedAt, *humeursSaisies',
      selfCareItems: 'id, tache, type, remonteDashboard, updatedAt',
      sportSessions: 'id, membre, date, updatedAt',
      tags: 'id, libelle, moduleContexte, updatedAt',
      categoriesProduits: 'id, nom, typeProduit, ordre, updatedAt',
      categoriesRecettes: 'id, nom, ordre, updatedAt',
      categoriesActivites: 'id, nom, ordre, updatedAt',
      parametresSync: 'id, &cle, updatedAt',
      exportSnapshots: 'id, dateExport, updatedAt',
      // ── Nouvelles tables v5 ───────────────────────────────────────────────
      pensees: [
        'id',
        'categorie',
        'statut',
        'dateDetectee',
        'enfantAssocie',
        'archive',
        'updatedAt',
      ].join(', '),
      routines: [
        'id',
        'creneau',
        'actif',
        'archive',
        'updatedAt',
      ].join(', '),
      routineItems: [
        'id',
        'routineId',
        'enfantAssocie',
        'ordre',
        'archive',
        'updatedAt',
      ].join(', '),
      croissanceMesures: [
        'id',
        'enfantId',
        'type',
        'date',
        'updatedAt',
      ].join(', '),
      sessionsPreparation: [
        'id',
        'dateSession',
        'statut',
        'updatedAt',
      ].join(', '),
    })

    // ─── Version 7 — Programmes pédagogiques IA, Import recettes, Partage ──
    this.version(7).stores({
      programmesPedagogiques: [
        'id',
        'theme',
        'statut',
        'dateDebut',
        'dateFin',
        'difficulte',
        'duree',
        'archive',
        'updatedAt',
        '*enfantsCibles',
        '*competencesCiblees',
      ].join(', '),
      activitesProgramme: [
        'id',
        'programmeId',
        'semaineNumero',
        '[programmeId+semaineNumero]',
        'source',
        'phase',
        'statutRealisation',
        'dateRealisation',
        'activiteCatalogueId',
        'archive',
        'updatedAt',
        '*competencesTravaillees',
      ].join(', '),
      programmesAnnuels: [
        'id',
        'annee',
        'statut',
        'archive',
        'updatedAt',
        '*enfantsCibles',
        '*programmesIds',
      ].join(', '),
      importsRecettesIA: [
        'id',
        'sourceType',
        'statut',
        'recetteId',
        'archive',
        'updatedAt',
      ].join(', '),
      contactsPartage: [
        'id',
        'actif',
        'updatedAt',
      ].join(', '),
      listesPartagees: [
        'id',
        'type',
        'contactId',
        'statut',
        'tokenAcces',
        'archive',
        'updatedAt',
      ].join(', '),
    })

    // ─── Version 8 — index composé [programmeId+semaineNumero] ───────────
    this.version(8).stores({
      activitesProgramme: [
        'id',
        'programmeId',
        'semaineNumero',
        '[programmeId+semaineNumero]',
        'source',
        'phase',
        'statutRealisation',
        'dateRealisation',
        'activiteCatalogueId',
        'archive',
        'updatedAt',
        '*competencesTravaillees',
      ].join(', '),
    })

    // ─── Version 10 — table evenementsDetails (module Réceptions) ────────
    this.version(10).stores({
      evenementsDetails: 'id, evenementId, archive, updatedAt',
    })

    // ─── Version 12 — sorties personnalisées ──────────────────────────────
    this.version(12).stores({
      sortiesPersonnelles: 'id, categorie, archive, updatedAt',
    })

    // ─── Version 13 — suppression croissanceMesures (fonctionnalité abandonnée) ──
    this.version(13).stores({
      croissanceMesures: null,
    })

    // ─── Version 14 — champs moteur Ménage ────────────────────────────────────
    // Nouveaux champs optionnels sur Tache (pas d'index → stores vide).
    // L'upgrade initialise les valeurs par défaut sur toutes les tâches maison
    // existantes pour éviter les undefined dans le moteur de décision.
    this.version(14).stores({}).upgrade(async tx => {
      const taches = await tx.table('taches')
        .filter((t: { moduleOrigine?: string }) => t.moduleOrigine === 'maison')
        .toArray()

      for (const t of taches) {
        const patch: Record<string, unknown> = {}
        if (t.missedCount            === undefined) patch.missedCount            = 0
        if (t.skippedUntil           === undefined) patch.skippedUntil           = null
        if (t.menageDifficulty       === undefined) patch.menageDifficulty       = 2
        if (t.menageVisualImpact     === undefined) patch.menageVisualImpact     = 2
        if (t.menageHealthImportance === undefined) patch.menageHealthImportance = 1
        if (Object.keys(patch).length > 0) {
          await tx.table('taches').update(t.id, patch)
        }
      }
    })

    // ─── Version 11 — migration avatars Blob → base64 string ────────────────
    // Ancienne v11 supprimait les non-Blob ; désormais avatar est une string base64
    // On supprime les Blob (non sérialisables) pour forcer un re-upload en string
    this.version(11).stores({}).upgrade(async tx => {
      const membres = await tx.table('membres').toArray()
      for (const m of membres) {
        if (m.avatar instanceof Blob) {
          await tx.table('membres').update(m.id, { avatar: undefined })
        }
      }
    })

    // ─── Version 9 — correction dates de naissance enfants ───────────────
    this.version(9).stores({}).upgrade(async tx => {
      // Corrige les dates de naissance si elles correspondent aux valeurs par défaut du seed
      const enfants = await tx.table('enfants').toArray()
      for (const e of enfants) {
        if (e.id === 'membre-manel' && e.dateNaissance === '2020-01-01') {
          await tx.table('enfants').update(e.id, { dateNaissance: '2022-10-01' })
        }
        if (e.id === 'membre-nawfel' && e.dateNaissance === '2022-01-01') {
          await tx.table('enfants').update(e.id, { dateNaissance: '2023-03-01' })
        }
      }
    })

    // ─── Version 6 — migration humeurs strings → nombres ──────────────────
    // Convertit les valeurs legacy ('tres_bien', 'bien'…) en échelle 1-7
    this.version(6).stores({}).upgrade(async tx => {
      const STRING_TO_NUM: Record<string, number> = {
        tres_difficile: 1,
        difficile:      2,
        neutre:         4,
        bien:           6,
        tres_bien:      7,
      }
      const humeurs = await tx.table('humeurs').toArray()
      for (const h of humeurs) {
        if (typeof h.valeur === 'string' && STRING_TO_NUM[h.valeur] !== undefined) {
          await tx.table('humeurs').update(h.id, { valeur: STRING_TO_NUM[h.valeur] })
        }
      }
    })
  }
}

// ─── Instance singleton ───────────────────────────────────────────────────────
export const db = new FamilyOSDatabase()

// ─── Helper : créer un enregistrement avec audit auto ────────────────────────
export function withAudit<T extends object>(data: T): T & { createdAt: Date; updatedAt: Date } {
  const now = new Date()
  return { ...data, createdAt: now, updatedAt: now }
}

export function withDevice<T extends object>(data: T, deviceId: string): T & { deviceId: string } {
  return { ...data, deviceId }
}
