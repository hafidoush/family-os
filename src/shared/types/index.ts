// ─────────────────────────────────────────────────────────────────────────────
// FAMILY OS — Types complets conformes au Data Model v2
// ─────────────────────────────────────────────────────────────────────────────

// ── Champs d'audit communs ────────────────────────────────────────────────────

export interface AuditFields {
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export interface AuditWithDevice extends AuditFields {
  deviceId: string
}

// ── Entités centrales ─────────────────────────────────────────────────────────

export type StatutTache = 'a_faire' | 'en_cours' | 'fait' | 'archive'
export type PrioriteTache = 'basse' | 'normale' | 'haute' | 'urgente'
export type ModuleOrigine =
  | 'dashboard'
  | 'dashboard_today'
  | 'cuisine'
  | 'enfants'
  | 'myself'
  | 'maison'
  | 'famille'
  | 'achats'
export type FrequenceTache =
  | 'quotidienne'
  | 'hebdomadaire'
  | 'bihebdomadaire'
  | 'mensuelle'
  | 'trimestrielle'
  | 'semestrielle'
  | 'annuelle'
  | 'ponctuelle'
export type JourSemaine = 'lun' | 'mar' | 'mer' | 'jeu' | 'ven' | 'sam' | 'dim'

export interface Tache extends AuditWithDevice {
  id: string
  titre: string
  description?: string
  statut: StatutTache
  priorite?: PrioriteTache
  moduleOrigine: ModuleOrigine
  contexteLibre?: string
  ordre?: number
  dateEcheance?: Date
  heureRappel?: string // "HH:mm"
  recurrence: boolean
  frequence?: FrequenceTache
  joursSemaine?: JourSemaine[]
  dureeEstimee?: number // minutes
  tags?: string[] // Tag.id[]
  pieceAssociee?: string // Piece.id
  enfantAssocie?: string // Enfant.id
  parentTache?: string // Tache.id
  evenementAssocie?: string // Evenement.id
  projetAssocie?: string // ProjetMaison.id
  completeeLe?: Date
  dateReference?: Date
  archive: boolean
  // ── Moteur Ménage ──────────────────────────────────────────────────────────
  missedCount?: number
  skippedUntil?: Date | null
  menageDifficulty?: 1 | 2 | 3
  menageVisualImpact?: 1 | 2 | 3
  menageHealthImportance?: 1 | 2 | 3
}

export type TypeEvenement =
  | 'rendez_vous'
  | 'anniversaire'
  | 'sortie'
  | 'evenement'
  | 'rappel'
  | 'medical'
export type FrequenceEvenement = 'quotidienne' | 'hebdomadaire' | 'mensuelle' | 'annuelle'

export interface Evenement extends AuditWithDevice {
  id: string
  titre: string
  description?: string
  type: TypeEvenement
  couleur?: string
  dateDebut: Date
  dateFin?: Date
  heureDebut?: string   // "HH:mm"
  heureFin?: string     // "HH:mm"
  journeeEntiere: boolean
  lieu?: string
  recurrence: boolean
  frequence?: FrequenceEvenement
  regleRecurrence?: import('./entities').RegleRecurrence
  alerteMinutes?: number
  personnesAssociees?: string[] // Enfant.id | Membre.id
  notes?: string
  moduleOrigine?: ModuleOrigine
  contexteMedical: boolean
  archive: boolean
}

export type TypeProduit = 'consommable' | 'achat_ponctuel'

export interface Produit extends AuditWithDevice {
  id: string
  nom: string
  nomNormalise?: string // calculé à la création, utilisé pour la recherche floue
  type: TypeProduit
  categorie: string // CategorieProduit.id (catégorie principale, rétrocompat)
  categorieIds?: string[] // CategorieProduit.id[] — supporte plusieurs catégories
  marque?: string
  photo?: Blob
  lienUrl?: string
  prixUnitaire?: number
  unite?: string
  stockActuel?: number
  seuilAlerte?: number
  frequenceAchat?: number // incrémenté à chaque ajout aux courses
  notes?: string
  tags?: string[] // Tag.id[]
  archive: boolean
}

export type ContexteWishlist =
  | 'myself'
  | 'maison'
  | 'enfants'
  | 'achats_besoins'
  | 'achats_envies'
export type StatutWishlist = 'a_decider' | 'approuve' | 'achete' | 'archive'
export type PrioriteWishlist = 'basse' | 'normale' | 'haute'

export interface WishlistItem extends AuditWithDevice {
  id: string
  nom: string
  contexte: ContexteWishlist
  sousContexte?: string
  pieceAssociee?: string // Piece.id
  photo?: Blob
  lienUrl?: string
  prix?: number
  priorite?: PrioriteWishlist
  statut: StatutWishlist
  enveloppeAssociee?: string // Enveloppe.id
  notes?: string
  archive: boolean
}

export type ValeurHumeur = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type SourceHumeur = 'saisie_rapide' | 'reunion_famille'

export interface Humeur extends AuditWithDevice {
  id: string
  membre: string // Membre.id
  valeur: ValeurHumeur
  icone?: string
  noteLibre?: string
  momentFort?: string
  objectifDemain?: string
  date: string // "YYYY-MM-DD"
  heure?: string // "HH:mm"
  source: SourceHumeur
}

export type ContexteNote =
  | 'global'
  | 'cuisine'
  | 'enfants'
  | 'myself'
  | 'maison'
  | 'famille'
  | 'achats'

export interface Note extends AuditWithDevice {
  id: string
  titre?: string
  contenu: string
  contexte: ContexteNote
  enfantAssocie?: string // Enfant.id
  pieceAssociee?: string // Piece.id
  tags?: string[] // Tag.id[]
  archive: boolean
}

export type CategorieEnveloppe =
  | 'alimentation'
  | 'maison'
  | 'enfants'
  | 'myself'
  | 'loisirs'
  | 'sante'
  | 'autre'
export type PeriodeEnveloppe = 'mensuelle' | 'trimestrielle' | 'annuelle' | 'ponctuelle'

export interface Enveloppe extends AuditWithDevice {
  id: string
  nom: string
  categorie: CategorieEnveloppe
  montantPrevu: number
  montantDepense: number // AUTO — calculé
  montantRestant: number // AUTO — calculé
  periode: PeriodeEnveloppe
  dateDebut: string // "YYYY-MM-DD"
  dateFin?: string
  alerteSeuil?: number // % déclencheur alerte
  archive: boolean
}

export type TypeTransaction = 'depense' | 'entree' | 'previsionnel'
export type SourceTransaction = 'manuelle' | 'automatique'

export interface Transaction extends AuditWithDevice {
  id: string
  montant: number
  type: TypeTransaction
  libelle: string
  enveloppeAssociee: string // Enveloppe.id
  achatAssocie?: string // WishlistItem.id
  date: string // "YYYY-MM-DD"
  source: SourceTransaction
  archive: boolean
}

// ── Entités modules ───────────────────────────────────────────────────────────

export type RoleMembre = 'parent' | 'enfant'

export interface Membre extends AuditWithDevice {
  id: string
  prenom: string
  role: RoleMembre
  avatar?: string
  couleur?: string
  actif: boolean
}

export interface Enfant extends AuditWithDevice {
  id: string // FK → Membre.id
  dateNaissance: string // "YYYY-MM-DD"
  niveauScolaire?: string
  informationsMedicales?: string
  medecinTraitant?: string
  groupeSanguin?: string
  objectifsActuels?: string[]
}

export type DifficulteActivite = 'facile' | 'moyen' | 'difficile'
export type StatutBibliotheque = 'a_faire' | 'demarrer' | 'realise' | 'favori'

export interface Activite extends AuditWithDevice {
  id: string
  nom: string
  ageMin?: number
  ageMax?: number
  dureeEstimee?: number
  materiel?: string[]
  categorie: string // CategorieActivite.id
  difficulte?: DifficulteActivite
  objectifPedagogique?: string
  competencesCiblees?: string[] // Competence.id[]
  instructions?: string
  statutBibliotheque: StatutBibliotheque
  photo?: Blob
  tags?: string[]
  archive: boolean
  // Préparation en amont (calculée par IA)
  preparationDelaiJours?: number
  preparationTexte?: string
  preparationUrgence?: 'immediate' | 'veille' | 'plusieurs_jours'
}

export interface SortiePersonnelle extends AuditWithDevice {
  id: string
  nom: string
  description: string
  ageMin: number
  ageMax: number
  dureeEstimee: number
  tarif?: string
  adresse: string
  informationsPratiques: string
  objectifs?: string
  categorie: string
  emoji: string
  archive: boolean
}

export type StatutPlanification = 'planifiee' | 'realisee' | 'annulee'

export interface PlanificationActivite extends AuditWithDevice {
  id: string
  activite: string // Activite.id
  enfant: string // Enfant.id
  datePrevue: string // "YYYY-MM-DD"
  heurePrevue?: string // "HH:mm"
  statut: StatutPlanification
  notes?: string
  archive?: boolean
}

export type DomaineCompetence =
  | 'langage'
  | 'pre_ecriture'
  | 'mathematiques'
  | 'decouverte_monde'
  | 'cognitif'
  | 'social_emotionnel'
  | 'vie_pratique'
  | 'creativite'
  | 'religion'
  | 'motricite'

export interface Competence extends AuditFields {
  id: string
  nom: string
  domaine: DomaineCompetence
  description?: string
  ageCible?: string
  ordreSuggere?: number
  competenceSuivante?: string // Competence.id
  archive?: boolean
}

export type StatutCompetence = 'a_travailler' | 'en_cours' | 'acquis'

export interface CompetenceSuivi extends AuditWithDevice {
  id: string
  enfant: string // Enfant.id
  competence: string // Competence.id
  statut: StatutCompetence
  dateDebut?: string
  dateAcquisition?: string
  notes?: string
  archive: boolean
}

export type TypeElementReligion = 'invocation' | 'sourate' | 'prophete' | 'duaa' | 'apprentissage'
export type StatutReligion = 'raconte' | 'etudie' | 'memorise'

export interface ElementReligion extends AuditWithDevice {
  id: string
  elementId: string // identifiant de l'élément de référence (sourate, prophète, duaa…)
  membreId: string // Membre.id — qui suit cet élément
  type: TypeElementReligion
  titreArabe?: string
  traduction?: string
  resume?: string
  valeurEnseignee?: string
  activiteAssociee?: string
  quiz?: string[]
  statuts: StatutReligion[] // plusieurs statuts simultanés possibles
  enfantAssocie?: string // Membre.id — legacy, remplacé par membreId
  archive: boolean
}

export type EquipementCuisine = 'four' | 'plaque' | 'robot' | 'plan_de_travail' | 'frigo' | 'aucun'

export interface EtapeStructuree {
  id: string                    // "etape-0", "etape-1"…
  description: string           // texte original inchangé
  dureeMinutes?: number
  type: 'actif' | 'passif'
  equipement: EquipementCuisine[]
}

export interface Recette extends AuditWithDevice {
  id: string
  nom: string
  image?: Blob       // legacy — préférer imageData pour la persistance iOS
  imageData?: string // base64 data URL — stockage fiable cross-platform
  tempsPreparation?: number // minutes
  tempsCuisson?: number // minutes
  portions?: number
  difficulte?: DifficulteActivite
  categorie: string // CategorieRecette.id
  tags?: string[]
  notes?: string                       // astuces, variantes, conseils
  etapes: string[]
  favori: boolean
  kidsFavorite?: boolean
  aProgrammer?: boolean
  archive: boolean
  // F8 — Préparation hebdomadaire
  typePreparation?: 'plat' | 'gouter' | 'dessert' | 'petit_dejeuner' | 'snack'
  modeConservation?: string          // "frigo", "congélateur", "température ambiante"
  dureeConservation?: number         // jours
  congelable?: boolean
  dernierePreparation?: string       // "YYYY-MM-DD"
  // Cache IA — étapes structurées (généré une fois, réutilisé si etapes[] inchangé)
  etapesStructurees?: EtapeStructuree[]
  etapesStructureesHash?: string     // hash de JSON.stringify(etapes) au moment de la structuration
}

export interface RecetteIngredient extends AuditFields {
  id: string
  recette: string // Recette.id
  produit: string // Produit.id
  quantite: number
  unite?: string
  optionnel: boolean
  groupe?: string  // ex: "Béchamel", "Sauce tomate" — regroupe les sous-préparations
}

export interface Menu extends AuditWithDevice {
  id: string
  semaine: 1 | 2
  nom?: string
  dateDebut: string // "YYYY-MM-DD" — lundi de la semaine
  dateFin?: string  // "YYYY-MM-DD" — dimanche de la semaine
  valide: boolean
  statut?: string
  archive: boolean
}

export type JourMenu = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche'
export type TypeRepas = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'collation'
export type RepasMenu = TypeRepas // alias utilisé dans les composants Menus
export type StatutMenuSlot = 'prevue' | 'realisee'

export interface MenuSlot extends AuditWithDevice {
  id: string
  menu: string // Menu.id
  jour?: JourMenu
  repas?: TypeRepas
  recette?: string // Recette.id
  descriptionLibre?: string
  statut?: StatutMenuSlot
  archive?: boolean
}

export type SourceCoursesItem = 'manuel' | 'stock_faible' | 'recette' | 'menu' | 'catalogue' | 'wishlist' | 'programme'

export interface CoursesItem extends AuditWithDevice {
  id: string
  produit: string // Produit.id
  nom?: string // saisie libre (sans produit catalogue)
  quantite?: number
  unite?: string
  coche: boolean
  source: SourceCoursesItem
  ajoutePar?: string // Membre.id
  dateAjout: Date
  categorieProduitId?: string // CategorieProduit.id
  notes?: string
  menuId?: string // Menu.id — si généré depuis un menu
  recetteId?: string // Recette.id — si généré depuis une recette
  archive?: boolean
}

export type EtatGeneral = 'tres_propre' | 'propre' | 'a_entretenir' | 'urgent'

export interface Piece extends AuditWithDevice {
  id: string
  nom: string
  icone?: string
  scoreProprety: number // 0–100 AUTO
  dernierEntretien?: Date
  etatGeneral?: EtatGeneral
  tauxDegradation?: number // points/jour
  actif: boolean
}

export type StatutProjet = 'a_faire' | 'en_cours' | 'termine' | 'archive'

export interface ProjetMaison extends AuditWithDevice {
  id: string
  nom: string
  pieceAssociee?: string // Piece.id
  description?: string
  progression?: number // AUTO 0–100 — calculé à la volée (D-03)
  statut: StatutProjet
  dateDebut?: string
  dateCible?: string
  budgetAssocie?: string // Enveloppe.id
  archive: boolean
}

export type TypeSouvenir = 'moment_fort' | 'reussite' | 'sortie' | 'autre'

export interface Souvenir extends AuditWithDevice {
  id: string
  titre: string
  description?: string
  date: string // "YYYY-MM-DD"
  photos?: Blob[]
  photosBase64?: string[]
  membresAssocies?: string[] // Membre.id[]
  tags?: string[]
  type?: TypeSouvenir
  archive: boolean
}

export interface ReunionFamille extends AuditWithDevice {
  id: string
  date: string // "YYYY-MM-DD"
  humeursSaisies: string[] // Humeur.id[] AUTO
  resume?: string
  terminee: boolean
}

export type TypeSelfCare = 'visage' | 'corps' | 'cheveux' | 'complement'

export interface SelfCareItem extends AuditWithDevice {
  id: string
  tache: string // Tache.id — la routine sous-jacente
  type: TypeSelfCare
  produitsUtilises?: string[]
  instructions?: string
  remonteDashboard: boolean
  derniereExecution?: Date
}

export interface SportSession extends AuditWithDevice {
  id: string
  membre: string // Membre.id
  typeEntrainement: string
  date: Date
  duree?: number
  metriques?: Record<string, unknown>
  notes?: string
  source?: 'manuelle' | 'import_app'
}

// ── Entités de référence ──────────────────────────────────────────────────────

export interface Tag extends AuditFields {
  id: string
  libelle: string
  couleur?: string
  moduleContexte?: ModuleOrigine
}

export type TypeProduitCategorie = 'consommable' | 'achat_ponctuel' | 'tous'

export interface CategorieProduit extends AuditFields {
  id: string
  nom: string
  icone?: string
  typeProduit: TypeProduitCategorie
  ordre: number
  personnalisee: boolean
}

export interface CategorieRecette extends AuditFields {
  id: string
  nom: string
  icone?: string
  ordre: number
}

export interface CategorieActivite extends AuditFields {
  id: string
  nom: string
  icone?: string
  ordre: number
}

// ── Entités système ───────────────────────────────────────────────────────────

export interface ParametreSync extends AuditFields {
  id: string
  cle: string
  valeur: string
  derniereModification: Date
  appareilSource?: string
}

export interface ExportSnapshot extends AuditFields {
  id: string
  dateExport: Date
  versionSchema: string
  donnees: string // JSON sérialisé
  appareilSource?: string
}

// ─── PENSÉE — F1 Décharger ma tête / F2 Tableau des oublis ───────────────────

export type CategoriePensee =
  | 'enfants'
  | 'maison'
  | 'administratif'
  | 'animaux'
  | 'achats'
  | 'evenements'
  | 'sante'
  | 'autre'

export type StatutPensee = 'active' | 'traitee' | 'reportee'

export interface Pensee extends AuditWithDevice {
  id: string
  contenu: string                  // texte libre saisi par l'utilisateur
  categorie: CategoriePensee       // détectée auto ou choisie manuellement
  dateDetectee?: string            // "YYYY-MM-DD" — date extraite du texte
  actionSuggeree?: string          // action déduite (ex: "acheter un cadeau")
  enfantAssocie?: string           // Enfant.id si détecté dans le texte
  statut: StatutPensee
  aFaire?: boolean                 // marquée "à faire" via le bouton → Faire
  archive: boolean
}

// ─── ROUTINE — F6 Routines adaptatives ───────────────────────────────────────

export type CreneauRoutine = 'matin' | 'midi' | 'apres_midi' | 'soir' | 'nuit'

export interface Routine extends AuditWithDevice {
  id: string
  nom: string
  creneau: CreneauRoutine          // détermine l'affichage automatique
  heureDebut?: string              // "HH:mm" optionnel — sinon basé sur créneau
  heureFin?: string                // "HH:mm"
  joursActifs?: JourSemaine[]      // vide = tous les jours
  actif: boolean
  ordre?: number
  archive: boolean
}

export interface RoutineItem extends AuditWithDevice {
  id: string
  routineId: string                // Routine.id
  libelle: string
  emoji?: string
  enfantAssocie?: string           // Enfant.id — item spécifique à un enfant
  ordre: number
  archive: boolean
}

// ─── CROISSANCE — F5 Suivi enfants ───────────────────────────────────────────

// ─── PRÉPARATION HEBDOMADAIRE — F8 ───────────────────────────────────────────

export interface IngredientAgrege {
  produitId: string
  nom: string
  quantiteTotale: number
  unite?: string
  optionnel: boolean
  recettesConcernees: { recetteId: string; recetteNom: string; quantite: number }[]
  fait: boolean
}

export interface EtapePreparation {
  id: string
  description: string
  recetteId?: string   // absent = action générale multi-recettes
  fait: boolean
}

export interface TachePlanning {
  recetteIds: string[]   // tableau — une tâche batchée peut couvrir plusieurs recettes
  etapeId: string
  description: string
  type: 'actif' | 'passif'
  equipement: string[]
  fait?: boolean
}

export interface BlocTimeline {
  tempsDebut: number
  tempsFin: number
  taches: TachePlanning[]
}

export interface ConservationRecette {
  recetteId: string
  recetteNom: string
  modeConservation: string
  dureeConservationJours?: number
  conseil: string
}

export interface PlanningGenere {
  // Phase 1 — Mise en place
  listeCourses?: IngredientAgrege[]
  preparationAmont?: EtapePreparation[]
  // Phase 2 — Exécution
  dureeTotaleMinutes: number
  timeline: BlocTimeline[]
  // Phase 3 — Clôture
  conservation: ConservationRecette[]
  recapFinal?: string
  // Meta
  conseils?: string[]          // ancien format — rétrocompatibilité
  alertesEquipement: string[]
  genereLe: string
}

export interface SessionPreparation extends AuditWithDevice {
  id: string
  dateSession: string              // "YYYY-MM-DD" — jour de préparation
  recetteIds: string[]             // Recette.id[] sélectionnées
  statut: 'planifiee' | 'en_cours' | 'terminee'
  notes?: string
  planning?: PlanningGenere        // généré par IA après création, instantané immuable
}

// ── Types utilitaires ─────────────────────────────────────────────────────────

export type EntityType =
  | 'tache'
  | 'evenement'
  | 'produit'
  | 'wishlistItem'
  | 'humeur'
  | 'note'
  | 'enveloppe'
  | 'transaction'
  | 'membre'
  | 'enfant'
  | 'activite'
  | 'planificationActivite'
  | 'competence'
  | 'competenceSuivi'
  | 'elementReligion'
  | 'recette'
  | 'recetteIngredient'
  | 'menu'
  | 'menuSlot'
  | 'coursesItem'
  | 'piece'
  | 'projetMaison'
  | 'souvenir'
  | 'reunionFamille'
  | 'selfCareItem'
  | 'sportSession'
  | 'programmePedagogique'
  | 'activiteProgramme'
  | 'programmeAnnuel'
  | 'importRecetteIA'
  | 'contactPartage'
  | 'listePartagee'

export interface SearchResult {
  id: string
  type: EntityType
  titre: string
  sousTitre?: string
  moduleOrigine: ModuleOrigine
  score: number
}

// ─── Habitudes utilisateur ────────────────────────────────────────────────────

/** Jour de la semaine numérique : 0 = dimanche, 1 = lundi … 6 = samedi (getDay()) */
export type JourSemaineNum = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Habitudes {
  // Rythme semaine
  jourCourses?: JourSemaineNum          // jour habituel pour faire les courses
  jourBatchCooking?: JourSemaineNum     // jour de préparation batch cooking
  joursTeletravail?: JourSemaineNum[]   // jours de télétravail

  // Menus
  frequenceRenouvellementMenus?: 'hebdomadaire' | 'bihebdomadaire'  // tous les combien replanifier

  // Ménage
  frequenceAspirateur?: 'quotidienne' | 'bihebdomadaire' | 'hebdomadaire' | 'bimensuelle'
  frequenceLinge?: 'quotidienne' | 'bihebdomadaire' | 'hebdomadaire' | 'bimensuelle'

  // Routines
  routineMatinActivee?: boolean
  routineSoirActivee?: boolean
  heureReveil?: string   // "HH:mm"
  heureCoucher?: string  // "HH:mm"
}

// ─── PROGRAMMES PÉDAGOGIQUES IA ───────────────────────────────────────────────

export type PhaseApprentissage =
  | 'decouverte'
  | 'exploration'
  | 'manipulation'
  | 'approfondissement'
  | 'consolidation'

export type DureeProgramme =
  | 'hebdomadaire'
  | 'mensuel'
  | 'trimestriel'
  | 'saisonnier'
  | 'annuel'

export type StatutProgramme = 'brouillon' | 'actif' | 'pause' | 'termine' | 'archive'

export type TypeTachePreparation = 'imprimer' | 'decoupe' | 'preparer' | 'acheter' | 'anticiper'
export type UrgenceTachePreparation = 'immediate' | 'cette_semaine' | 'prochaine_semaine'

export interface TachePreparation {
  id: string
  titre: string
  type: TypeTachePreparation
  urgence: UrgenceTachePreparation
  dureeEstimee: number                 // minutes
  dateIdeal?: string                   // "YYYY-MM-DD"
  faite: boolean
  activiteAssocieeId?: string          // ActiviteProgramme.id
}

export interface ItemMateriel {
  nom: string
  quantite?: string
  aAcheter: boolean
  produitId?: string                   // Produit.id — si correspondance catalogue
}

export interface EtapeActiviteProgramme {
  ordre: number
  texte: string
  duree?: number                       // minutes
  conseil?: string
}

export interface VarianteAge {
  ageMin: number
  ageMax: number
  adaptation: string
}

export interface SemaineProgramme {
  numero: number
  titre: string
  objectif: string
  phase: PhaseApprentissage
  activiteIds: string[]                // ActiviteProgramme.id[]
  tachesPreparation: TachePreparation[]
}

export type SourceActiviteProgramme = 'catalogue' | 'generee_ia' | 'importee'
export type StatutRealisationActivite = 'a_faire' | 'planifie' | 'realise' | 'saute'

export interface ActiviteProgramme extends AuditWithDevice {
  id: string
  programmeId: string                  // ProgrammePedagogique.id
  semaineNumero: number

  // Origine
  source: SourceActiviteProgramme
  activiteCatalogueId?: string         // Activite.id — si issue du catalogue

  // Contenu (toujours rempli — copié ou généré)
  titre: string
  description: string
  objectifPedagogique: string
  phase: PhaseApprentissage
  competencesTravaillees: string[]     // Competence.id[]

  // Logistique
  materielNecessaire: ItemMateriel[]
  materielOptionnel: ItemMateriel[]
  tempsPreparation: number             // minutes
  duree: number                        // minutes
  ageRecommande: string                // "3–6 ans"

  // Déroulement
  deroulement: EtapeActiviteProgramme[]
  variantes?: VarianteAge[]

  // Immersion (complémentaire — optionnel, n'écrase pas l'existant)
  preparationSpecifique?: string[]     // ce que l'adulte doit préparer avant CETTE activité
  ideesImmersion?: string[]            // accessoires/mises en scène propres à cette activité

  // État
  ordre: number
  statutRealisation: StatutRealisationActivite
  dateRealisation?: string             // "YYYY-MM-DD"
  datePlanifiee?: string               // "YYYY-MM-DD" — jour choisi par l'utilisateur
  notesParent?: string
  archive: boolean
}

// ─── IMMERSION PÉDAGOGIQUE (programme) ────────────────────────────────────────

export interface IntroductionTheme {
  histoire: string         // histoire de départ pour entrer dans l'univers
  presentation: string     // façon de présenter le thème aux enfants
  rituelLancement: string  // rituel de lancement de semaine/programme
  miseEnScene: string      // idée de mise en scène
}

export interface ConclusionProgramme {
  jeuFinal: string
  activiteRestitution: string
  ideeSouvenir: string
  questionsBilan?: string[]
}

export interface ProgrammePedagogique extends AuditWithDevice {
  id: string
  titre: string
  theme: string                        // "animaux_ferme", "espace", "printemps"…
  description?: string

  // Paramètres
  ageMin: number
  ageMax: number
  enfantsCibles: string[]              // Enfant.id[]
  duree: DureeProgramme
  frequenceParSemaine: number          // 1–7
  difficulte: DifficulteActivite
  objectifsPedagogiques: string[]
  competencesCiblees: string[]         // Competence.id[]

  // Génération IA
  genereParIA: boolean
  promptGeneration?: string
  dateGeneration?: string              // "YYYY-MM-DD"
  modelIA?: string                     // "gpt-4o", "gpt-4o-mini"

  // Structure
  dateDebut: string                    // "YYYY-MM-DD"
  dateFin: string                      // "YYYY-MM-DD"
  semaines: SemaineProgramme[]         // JSON embarqué (max 52 semaines)

  statut: StatutProgramme
  progression: number                  // 0–100 — calculé à la volée
  materielStatuts?: Record<string, 'a_verifier' | 'possede' | 'a_acheter'>  // clé = nom normalisé
  archive: boolean

  // Immersion pédagogique (complémentaire — optionnel, n'écrase pas l'existant)
  introductionTheme?: IntroductionTheme  // section "Introduction du thème" avant les activités
  conclusion?: ConclusionProgramme       // section "Mission finale / conclusion"
  ideesImmersion?: string[]              // "Bonus immersion" globaux au programme (accessoires, déco…)
}

// ─── PROGRAMME ANNUEL ─────────────────────────────────────────────────────────

export interface RepartitionMois {
  mois: number                         // 1–12
  theme: string
  sousTheme?: string
  programmeId?: string                 // ProgrammePedagogique.id
  competencesPrioritaires: string[]    // Competence.id[]
  raisonPedagogique?: string
}

export interface ProgrammeAnnuel extends AuditWithDevice {
  id: string
  annee: number                        // ex: 2026
  enfantsCibles: string[]              // Enfant.id[]
  repartitionMensuelle: RepartitionMois[]
  programmesIds: string[]              // ProgrammePedagogique.id[]
  genereParIA: boolean
  statut: StatutProgramme
  archive: boolean
}

// ─── IMPORT RECETTES IA ───────────────────────────────────────────────────────

export type SourceTypeImportRecette = 'url' | 'screenshot' | 'texte_libre'
export type StatutImportRecette = 'en_attente' | 'extraction' | 'a_valider' | 'valide' | 'erreur'

export interface IngredientExtrait {
  nom: string
  quantite?: number
  unite?: string
  optionnel: boolean
  produitMatchId?: string              // Produit.id — si correspondance trouvée
  groupe?: string                      // ex: "Béchamel", "Sauce tomate"
}

export interface RecetteExtractee {
  nom: string
  tempsPreparation?: number            // minutes
  tempsCuisson?: number                // minutes
  portions?: number
  difficulte?: DifficulteActivite
  ingredients: IngredientExtrait[]
  etapes: string[]
  tags?: string[]
  notes?: string                       // astuces, variantes, conseils détectés par l'IA
  sourceOriginale: string
  confidenceScore: number              // 0–1
}

export interface ImportRecetteIA extends AuditWithDevice {
  id: string
  sourceType: SourceTypeImportRecette
  sourceUrl?: string
  sourceTexte?: string
  sourceImageData?: string             // base64
  recetteExtractee?: RecetteExtractee  // JSON brut avant validation parent
  recetteId?: string                   // Recette.id — après validation + sauvegarde
  statut: StatutImportRecette
  erreur?: string
  archive: boolean
}

// ─── RÉCEPTIONS ───────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string
  label: string
  coche: boolean
}

export type TypeMenuItem = 'plat' | 'dessert' | 'boisson' | 'autre'

export interface EvenementMenuItem {
  id: string
  type: TypeMenuItem
  label: string
  recetteId?: string  // Recette.id — si liée à une recette existante
}

export interface EvenementCoursesItem {
  id: string
  label: string
  quantite?: number
  unite?: string
  coche: boolean
  produitId?: string  // Produit.id — si lié au catalogue
}

export interface EvenementDetail extends AuditWithDevice {
  id: string          // = evenement.id
  evenementId: string // FK → Evenement.id
  nbAdultes?: number
  nbEnfants?: number
  prenomInvites?: string[]
  menuItems?: EvenementMenuItem[]
  coursesItems?: EvenementCoursesItem[]
  checklistPrep?: ChecklistItem[]
  checklistDeco?: ChecklistItem[]
  suggestionIA?: string
  archive: boolean
}

// ─── PARTAGE FAMILIAL ─────────────────────────────────────────────────────────

export type MethodeEnvoiPartage = 'whatsapp' | 'sms' | 'email' | 'copier_lien'
export type TypeListePartagee = 'courses' | 'materiel' | 'preparation' | 'taches'
export type StatutListePartagee = 'active' | 'expiree' | 'fermee'

export interface ContactPartage extends AuditWithDevice {
  id: string
  nom: string                          // "Élies"
  telephone?: string
  email?: string
  methodeEnvoi: MethodeEnvoiPartage
  actif: boolean
}

export interface ItemListePartagee {
  id: string
  texte: string
  coche: boolean
  cocheAt?: string                     // ISO datetime
  cocheParContact: boolean             // true = coché côté conjoint
  ordre: number
}

export interface ListePartagee extends AuditWithDevice {
  id: string
  type: TypeListePartagee
  titre: string
  contactId?: string                   // ContactPartage.id — optionnel (lien anonyme possible)
  canalSupabase?: string               // channel UUID Supabase Realtime
  lienPublic?: string                  // URL d'accès sans compte
  tokenAcces: string                   // UUID secret (autorisation sans compte)
  items: ItemListePartagee[]
  derniereSyncAt?: string              // ISO datetime
  statut: StatutListePartagee
  archive: boolean
}
