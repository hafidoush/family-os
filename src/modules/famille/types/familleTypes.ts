/**
 * FAMILY OS — Types locaux Module Famille
 * Types UI/vues distincts des types Dexie partagés
 */

import type { Evenement, Humeur } from '@shared/types/entities';
import type { Souvenir, ReunionFamille, Membre } from '@shared/types/modules';

// ─── Vues enrichies ───────────────────────────────────────────────────────────

export interface EvenementAvecMembres extends Evenement {
  membresResolus?: Membre[];
}

export interface ReunionAvecHumeurs extends ReunionFamille {
  humeursResolues?: Humeur[];
  nbParticipants?: number;
}

export interface SouvenirAvecMembres extends Souvenir {
  membresResolus?: Membre[];
}

// ─── État UI ─────────────────────────────────────────────────────────────────

export type OngletFamille =
  | 'membres'
  | 'reunions'
  | 'souvenirs';

export type VueCalendrier = 'semaine' | 'mois';

// ─── Formulaires ─────────────────────────────────────────────────────────────

export interface EvenementFormData {
  titre: string;
  description?: string;
  type: Evenement['type'];
  couleur?: string;
  dateDebut: string;     // "YYYY-MM-DDTHH:mm"
  dateFin?: string;
  journeeEntiere: boolean;
  lieu?: string;
  recurrence: boolean;
  frequence?: Evenement['frequence'];
  regleRecurrence?: Evenement['regleRecurrence'];
  alerteMinutes?: number;  // -1 = aucune, 0 = à l'heure, 15/30/60/1440 = avant
  personnesAssociees: string[];
  notes?: string;
  contexteMedical: boolean;
  sousTaches?: { titre: string; fait: boolean; id?: string }[];
}

export interface ReunionFormData {
  date: string; // "YYYY-MM-DD"
  heure?: string; // "HH:mm"
  agenda?: string;
  participantIds?: string[];
  resume?: string;
}

export interface SouvenirFormData {
  titre: string;
  description?: string;
  date: string; // "YYYY-MM-DD"
  membresAssocies: string[];
  tags?: string[];
  type?: Souvenir['type'];
  photosBase64?: string[];
}
