/**
 * FAMILY OS — Entités Centrales
 * Toutes les propriétés en camelCase (CONVENTIONS.md §1)
 */

import type { AuditFields, DeviceField } from './audit';

// ─── TÂCHE ────────────────────────────────────────────────────────────────────

export type StatutTache = 'a_faire' | 'en_cours' | 'fait' | 'archive';
export type PrioriteTache = 'basse' | 'normale' | 'haute' | 'urgente';
export type ModuleOrigine =
  | 'dashboard'
  | 'dashboard_today'
  | 'cuisine'
  | 'enfants'
  | 'myself'
  | 'maison'
  | 'famille'
  | 'achats';
export type FrequenceTache =
  | 'quotidienne'
  | 'hebdomadaire'
  | 'bihebdomadaire'
  | 'mensuelle'
  | 'trimestrielle'
  | 'semestrielle'
  | 'annuelle'
  | 'ponctuelle';
export type JourSemaine = 'lun' | 'mar' | 'mer' | 'jeu' | 'ven' | 'sam' | 'dim';

export interface Tache extends AuditFields, DeviceField {
  id: string;
  titre: string;
  description?: string;
  statut: StatutTache;
  priorite?: PrioriteTache;
  moduleOrigine: ModuleOrigine;
  contexteLibre?: string;
  ordre?: number;
  dateEcheance?: Date;
  heureRappel?: string; // "HH:mm"
  recurrence: boolean;
  frequence?: FrequenceTache;
  joursSemaine?: JourSemaine[];
  dureeEstimee?: number; // minutes
  tags?: string[]; // Tag.id[]
  pieceAssociee?: string; // Piece.id
  enfantAssocie?: string; // Enfant.id
  parentTache?: string; // Tache.id
  evenementAssocie?: string; // Evenement.id — sous-tâche d'un événement
  projetAssocie?: string; // ProjetMaison.id
  completeeLe?: Date;
  dateReference?: Date; // date de départ pour le calcul de la prochaine échéance
  archive: boolean;
  // ── Moteur Ménage (moduleOrigine === 'maison' uniquement) ──────────────────
  missedCount?: number           // oublis consécutifs non cochés
  skippedUntil?: Date | null     // "Pas aujourd'hui" — réapparaît après cette date
  menageDifficulty?: 1 | 2 | 3  // 1=léger, 2=moyen, 3=intensif
  menageVisualImpact?: 1 | 2 | 3      // 1=invisible, 3=très visible
  menageHealthImportance?: 1 | 2 | 3  // 1=esthétique, 3=sanitaire
}

// ─── ÉVÉNEMENT ────────────────────────────────────────────────────────────────

export type TypeEvenement =
  | 'rendez_vous'
  | 'anniversaire'
  | 'sortie'
  | 'evenement'
  | 'rappel'
  | 'medical';
export type FrequenceEvenement = 'quotidienne' | 'hebdomadaire' | 'mensuelle' | 'annuelle';

// ─── Règle de récurrence complète ────────────────────────────────────────────

export interface RegleRecurrence {
  frequence: FrequenceEvenement;

  /** Répéter tous les N unités (1 = chaque semaine, 2 = toutes les 2 semaines…) */
  intervalle: number;

  // ── Hebdomadaire ──────────────────────────────────────────
  /** Jours de la semaine concernés : 0=Dim 1=Lun … 6=Sam */
  joursHebdo?: number[];

  // ── Mensuel ───────────────────────────────────────────────
  typeMensuel?: 'jourFixe' | 'positionSemaine';
  /** "Le 15 du mois" */
  jourFixe?: number;
  /** Position dans le mois : 1=1er 2=2ème 3=3ème 4=4ème -1=dernier */
  positionSemaine?: 1 | 2 | 3 | 4 | -1;
  /** Jour de la semaine pour positionSemaine (0=Dim … 6=Sam) */
  jourDeSemaine?: number;

  // ── Plage de validité ─────────────────────────────────────
  /** ISO date — début de la récurrence (inclus) */
  dateDebutRecurrence: string;
  /** ISO date — fin de la récurrence (inclus, null = indéfini) */
  dateFinRecurrence?: string;
  /** Nombre max d'occurrences (prioritaire sur dateFinRecurrence) */
  maxOccurrences?: number;

  // ── Exceptions ────────────────────────────────────────────
  /** ISO dates (YYYY-MM-DD) à exclure explicitement */
  exceptions?: string[];
}

export interface Evenement extends AuditFields, DeviceField {
  id: string;
  titre: string;
  description?: string;
  type: TypeEvenement;
  couleur?: string;          // hex color code
  dateDebut: Date;
  dateFin?: Date;
  heureDebut?: string;    // "HH:MM"
  heureFin?: string;      // "HH:MM"
  journeeEntiere: boolean;
  lieu?: string;
  recurrence: boolean;
  frequence?: FrequenceEvenement;           // rétrocompat
  regleRecurrence?: RegleRecurrence;        // nouveau système
  alerteMinutes?: number;    // minutes avant l'événement (0 = à l'heure, -1 = aucune)
  personnesAssociees?: string[];
  notes?: string;
  moduleOrigine?: ModuleOrigine;
  contexteMedical: boolean;
  archive: boolean;
}

// ─── PRODUIT ──────────────────────────────────────────────────────────────────

export type TypeProduit = 'consommable' | 'achat_ponctuel';

export interface Produit extends AuditFields, DeviceField {
  id: string;
  nom: string;
  nomNormalise?: string; // calculé à la création, utilisé pour la recherche floue
  type: TypeProduit;
  categorie: string; // CategorieProduit.id (catégorie principale, rétrocompat)
  categorieIds?: string[]; // CategorieProduit.id[] — supporte plusieurs catégories
  marque?: string;
  photo?: Blob;
  lienUrl?: string;
  prixUnitaire?: number;
  unite?: string;
  stockActuel?: number;
  seuilAlerte?: number;
  frequenceAchat?: number; // incrémenté à chaque ajout aux courses
  notes?: string;
  tags?: string[];
  archive: boolean;
}

// ─── WISHLIST ITEM ────────────────────────────────────────────────────────────

export type ContexteWishlist =
  | 'myself'
  | 'maison'
  | 'enfants'
  | 'achats_besoins'
  | 'achats_envies';
export type StatutWishlist = 'a_decider' | 'approuve' | 'achete' | 'archive';
export type PrioriteWishlist = 'basse' | 'normale' | 'haute';

export interface WishlistItem extends AuditFields, DeviceField {
  id: string;
  nom: string;
  contexte: ContexteWishlist;
  sousContexte?: string;
  pieceAssociee?: string;
  photo?: Blob;
  lienUrl?: string;
  prix?: number;
  priorite?: PrioriteWishlist;
  statut: StatutWishlist;
  enveloppeAssociee?: string;
  notes?: string;
  archive: boolean;
  // M-03 : champ ajouté pour A-20 (consommable vs non-consommable)
  estConsommable: boolean;
}

// ─── HUMEUR ───────────────────────────────────────────────────────────────────

// Échelle numérique 1–7 : reflète ce qui est réellement stocké en base
// (1 = très difficile … 7 = excellent)
export type ValeurHumeur = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type SourceHumeur = 'saisie_rapide' | 'reunion_famille';

export interface Humeur extends AuditFields, DeviceField {
  id: string;
  membre: string; // Membre.id
  valeur: ValeurHumeur;
  icone?: string;
  noteLibre?: string;
  momentFort?: string;
  objectifDemain?: string;
  date: string; // "YYYY-MM-DD"
  heure?: string; // "HH:mm"
  source: SourceHumeur;
}

// ─── NOTE ─────────────────────────────────────────────────────────────────────

export type ContexteNote =
  | 'global'
  | 'cuisine'
  | 'enfants'
  | 'myself'
  | 'maison'
  | 'famille'
  | 'achats';

export interface Note extends AuditFields, DeviceField {
  id: string;
  titre?: string;
  contenu: string;
  contexte: ContexteNote;
  enfantAssocie?: string;
  pieceAssociee?: string;
  tags?: string[];
  archive: boolean;
}

// ─── ENVELOPPE ────────────────────────────────────────────────────────────────

export type CategorieEnveloppe =
  | 'alimentation'
  | 'maison'
  | 'enfants'
  | 'myself'
  | 'loisirs'
  | 'sante'
  | 'autre';
export type PeriodeEnveloppe = 'mensuelle' | 'trimestrielle' | 'annuelle' | 'ponctuelle';

export interface Enveloppe extends AuditFields, DeviceField {
  id: string;
  nom: string;
  categorie: CategorieEnveloppe;
  montantPrevu: number;
  // montantDepense et montantRestant : calculés à la volée, jamais stockés (D-03)
  periode: PeriodeEnveloppe;
  dateDebut: string; // "YYYY-MM-DD"
  dateFin?: string;
  alerteSeuil?: number; // % déclenchant l'alerte
  archive: boolean;
}

// ─── TRANSACTION ──────────────────────────────────────────────────────────────

export type TypeTransaction = 'depense' | 'entree' | 'previsionnel';
export type SourceTransaction = 'manuelle' | 'automatique';

export interface Transaction extends AuditFields, DeviceField {
  id: string;
  montant: number;
  type: TypeTransaction;
  libelle: string;
  enveloppeAssociee: string;
  achatAssocie?: string; // WishlistItem.id
  date: string; // "YYYY-MM-DD"
  source: SourceTransaction;
  archive: boolean;
}
