/**
 * FAMILY OS — Entités Modules
 * Toutes les propriétés en camelCase (CONVENTIONS.md §1)
 */

import type { AuditFields, DeviceField } from './audit';

// ─── MEMBRE ───────────────────────────────────────────────────────────────────

export type RoleMembre = 'parent' | 'enfant';

export interface Membre extends AuditFields, DeviceField {
  id: string;
  prenom: string;
  role: RoleMembre;
  avatar?: string;
  couleur?: string;
  actif: boolean;
}

// ─── ENFANT ───────────────────────────────────────────────────────────────────

export interface Enfant extends AuditFields, DeviceField {
  id: string; // PK + FK → Membre.id
  dateNaissance: string; // "YYYY-MM-DD"
  niveauScolaire?: string;
  informationsMedicales?: string;
  medecinTraitant?: string;
  groupeSanguin?: string;
  objectifsActuels?: string[];
}

// ─── ACTIVITÉ ─────────────────────────────────────────────────────────────────

export type DifficulteActivite = 'facile' | 'moyen' | 'difficile';
export type StatutBibliotheque = 'a_faire' | 'demarrer' | 'realise' | 'favori';

export interface Activite extends AuditFields, DeviceField {
  id: string;
  nom: string;
  ageMin?: number;
  ageMax?: number;
  dureeEstimee?: number;
  materiel?: string[];
  categorie: string; // CategorieActivite.id
  difficulte?: DifficulteActivite;
  objectifPedagogique?: string;
  competencesCiblees?: string[]; // Competence.id[]
  instructions?: string;
  statutBibliotheque: StatutBibliotheque;
  photo?: Blob;
  tags?: string[];
  archive: boolean;
  // Préparation en amont (calculée par IA)
  preparationDelaiJours?: number;       // 0 = immédiat, 1 = veille, 2-3 = plusieurs jours
  preparationTexte?: string;            // Description de la préparation
  preparationUrgence?: 'immediate' | 'veille' | 'plusieurs_jours';
}

// ─── PLANIFICATION ACTIVITÉ ───────────────────────────────────────────────────

export type StatutPlanification = 'planifiee' | 'realisee' | 'annulee';

export interface PlanificationActivite extends AuditFields, DeviceField {
  id: string;
  activite: string; // Activite.id
  enfant: string; // Enfant.id
  datePrevue: string; // "YYYY-MM-DD"
  heurePrevue?: string; // "HH:mm"
  statut: StatutPlanification;
  notes?: string;
  archive?: boolean;
}

// ─── COMPÉTENCE ───────────────────────────────────────────────────────────────

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
  | 'motricite';

export interface Competence extends AuditFields {
  id: string;
  nom: string;
  domaine: DomaineCompetence;
  description?: string;
  ageCible?: string;
  ordreSuggere?: number;
  competenceSuivante?: string; // Competence.id
  archive?: boolean;
}

// ─── COMPÉTENCE SUIVI ─────────────────────────────────────────────────────────

export type StatutCompetence = 'a_travailler' | 'en_cours' | 'acquis';

export interface CompetenceSuivi extends AuditFields, DeviceField {
  id: string;
  enfant: string; // Enfant.id
  competence: string; // Competence.id
  statut: StatutCompetence;
  dateDebut?: string;
  dateAcquisition?: string;
  notes?: string;
  archive: boolean;
}

// ─── ÉLÉMENT RELIGION ─────────────────────────────────────────────────────────

export type TypeReligion = 'invocation' | 'sourate' | 'prophete' | 'duaa' | 'apprentissage';
export type StatutReligion = 'raconte' | 'etudie' | 'memorise';

export interface ElementReligion extends AuditFields, DeviceField {
  id: string;
  elementId: string; // identifiant de l'élément de référence (sourate, prophète, duaa…)
  membreId: string; // Membre.id — qui suit cet élément
  type: TypeReligion;
  titreArabe?: string;
  traduction?: string;
  resume?: string;
  valeurEnseignee?: string;
  activiteAssociee?: string;
  quiz?: string[];
  statuts: StatutReligion[]; // plusieurs statuts simultanés possibles
  enfantAssocie?: string; // Enfant.id — legacy, remplacé par membreId
  archive: boolean;
}

// ─── RECETTE ──────────────────────────────────────────────────────────────────

export type DifficulteRecette = 'facile' | 'moyen' | 'difficile';

export interface Recette extends AuditFields, DeviceField {
  id: string;
  nom: string;
  image?: Blob;
  tempsPreparation?: number;
  tempsCuisson?: number;
  portions?: number;
  difficulte?: DifficulteRecette;
  categorie: string; // CategorieRecette.id
  tags?: string[];
  etapes: string[];
  favori: boolean;
  kidsFavorite?: boolean;
  archive: boolean;
}

// ─── RECETTE INGRÉDIENT ───────────────────────────────────────────────────────

export interface RecetteIngredient extends AuditFields {
  id: string;
  recette: string; // Recette.id
  produit: string; // Produit.id
  quantite: number;
  unite?: string;
  optionnel: boolean;
}

// ─── MENU ─────────────────────────────────────────────────────────────────────

export interface Menu extends AuditFields, DeviceField {
  id: string;
  semaine: 1 | 2;
  dateDebut: string; // "YYYY-MM-DD" (lundi de la semaine)
  dateFin?: string;  // "YYYY-MM-DD" (dimanche de la semaine) — pour useTodayMenu
  valide: boolean;
  archive: boolean;
}

// ─── MENU SLOT ────────────────────────────────────────────────────────────────

export type JourMenu =
  | 'lundi' | 'mardi' | 'mercredi' | 'jeudi'
  | 'vendredi' | 'samedi' | 'dimanche';
export type RepasMenu = 'petit_dejeuner' | 'dejeuner' | 'diner' | 'collation';
export type StatutMenuSlot = 'prevue' | 'realisee';

export interface MenuSlot extends AuditFields, DeviceField {
  id: string;
  menu: string;             // Menu.id
  jour?: JourMenu;          // optionnel — si absent, recette prévue sans jour fixe
  repas?: RepasMenu;        // optionnel — si absent, pas de catégorie de repas
  recette?: string;         // Recette.id
  descriptionLibre?: string;
  statut: StatutMenuSlot;   // 'prevue' | 'realisee'
}

// ─── COURSES ITEM ─────────────────────────────────────────────────────────────

export type SourceCourses = 'manuel' | 'stock_faible' | 'recette' | 'menu' | 'catalogue';

export interface CoursesItem extends AuditFields, DeviceField {
  id: string;
  produit: string; // Produit.id
  quantite?: number;
  unite?: string;
  coche: boolean;
  source: SourceCourses;
  ajoutePar?: string; // Membre.id — M-01 v2
  dateAjout: Date;
}

// ─── PIÈCE ────────────────────────────────────────────────────────────────────

export type EtatGeneral = 'tres_propre' | 'propre' | 'a_entretenir' | 'urgent';

export interface Piece extends AuditFields, DeviceField {
  id: string;
  nom: string;
  icone?: string;
  scoreProprety: number; // 0–100
  dernierEntretien?: Date;
  etatGeneral?: EtatGeneral;
  tauxDegradation?: number; // points perdus par jour
  actif: boolean;
}

// ─── PROJET MAISON ────────────────────────────────────────────────────────────

export type StatutProjet = 'a_faire' | 'en_cours' | 'termine' | 'archive';

export interface ProjetMaison extends AuditFields, DeviceField {
  id: string;
  nom: string;
  pieceAssociee?: string;
  description?: string;
  // progression : calculée à la volée (D-03)
  statut: StatutProjet;
  dateDebut?: string;
  dateCible?: string;
  budgetAssocie?: string; // Enveloppe.id
  archive: boolean;
}

// ─── SOUVENIR ─────────────────────────────────────────────────────────────────

export type TypeSouvenir = 'moment_fort' | 'reussite' | 'sortie' | 'autre';

export interface Souvenir extends AuditFields, DeviceField {
  id: string;
  titre: string;
  description?: string;
  date: string; // "YYYY-MM-DD"
  photos?: Blob[];
  photosBase64?: string[];
  membresAssocies?: string[];
  tags?: string[];
  type?: TypeSouvenir;
  archive: boolean;
}

// ─── RÉUNION FAMILLE ──────────────────────────────────────────────────────────

export interface ReunionFamille extends AuditFields, DeviceField {
  id: string;
  date: string; // "YYYY-MM-DD"
  heure?: string; // "HH:mm"
  agenda?: string;
  participantIds?: string[]; // Membre.id[]
  humeursSaisies?: string[]; // Humeur.id[]
  resume?: string;
  terminee: boolean;
}

// ─── SELF CARE ITEM ───────────────────────────────────────────────────────────

export type TypeSelfCare = 'visage' | 'corps' | 'cheveux' | 'complement';

export interface SelfCareItem extends AuditFields, DeviceField {
  id: string;
  tache: string; // Tache.id
  type: TypeSelfCare;
  produitsUtilises?: string[];
  instructions?: string;
  remonteDashboard: boolean;
  derniereExecution?: Date;
}

// ─── SPORT SESSION ────────────────────────────────────────────────────────────

export type SourceSport = 'manuelle' | 'import_app';

export interface SportSession extends AuditFields, DeviceField {
  id: string;
  membre: string; // Membre.id — M-01 : indexé dans Dexie
  typeEntrainement: string;
  date: Date;
  duree?: number;
  metriques?: Record<string, unknown>;
  notes?: string;
  source?: SourceSport;
}

// ─── ENTITÉS DE RÉFÉRENCE ─────────────────────────────────────────────────────

export interface Tag extends AuditFields {
  id: string;
  libelle: string;
  couleur?: string;
  moduleContexte?: ModuleContexteTag;
}

export type ModuleContexteTag =
  | 'cuisine'
  | 'enfants'
  | 'myself'
  | 'maison'
  | 'famille'
  | 'achats';

export interface CategorieProduit extends AuditFields {
  id: string;
  nom: string;
  icone?: string;
  typeProduit: 'consommable' | 'achat_ponctuel' | 'tous';
  ordre: number;
  personnalisee: boolean;
}

export interface CategorieRecette extends AuditFields {
  id: string;
  nom: string;
  icone?: string;
  ordre: number;
}

export interface CategorieActivite extends AuditFields {
  id: string;
  nom: string;
  icone?: string;
  ordre: number;
}

// ─── ENTITÉS SYSTÈME ──────────────────────────────────────────────────────────

export interface ParametreSync extends AuditFields {
  id: string;
  cle: string;
  valeur: string;
  dernierModification: Date;
  appareilSource?: string;
}

export interface ExportSnapshot extends AuditFields {
  id: string;
  dateExport: Date;
  versionSchema: string;
  donnees: Record<string, unknown>;
  appareilSource?: string;
}
