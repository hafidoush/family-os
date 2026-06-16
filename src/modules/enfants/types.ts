// Types spécifiques au module Enfants

export type EnfantSection = 'activites' | 'competences' | 'religion' | 'catalogue' | 'sorties' | 'programmes';

export interface EnfantTab {
  id: EnfantSection;
  label: string;
  icon: string;
  color: string;
}

export const ENFANT_TABS: EnfantTab[] = [
  { id: 'activites',   label: 'Activités',   icon: '⚡', color: 'var(--color-enfants-activites)'   },
  { id: 'competences', label: 'Compétences', icon: '⭐', color: 'var(--color-enfants-competences)' },
  { id: 'religion',    label: 'Religion',    icon: '🌙', color: 'var(--color-enfants-religion)'    },
  { id: 'catalogue',   label: 'Catalogue',   icon: '📋', color: '#A78BFA'                          },
  { id: 'programmes',  label: 'Programmes',  icon: '🎯', color: '#7C3AED'                          },
];

export type StatutActivite   = 'planifiee' | 'realisee' | 'annulee';
export type StatutCompetence = 'non_commence' | 'en_cours' | 'acquis';
export type StatutReligion   = 'raconte' | 'etudie' | 'memorise';

export interface MembreEnfantProfile {
  membreId: string;
  nom: string;
  prenom: string;
  couleur: string;
  age?: number;
}

export const MEMBRES_ENFANTS: MembreEnfantProfile[] = [
  { membreId: 'membre-manel',  nom: 'Manel',  prenom: 'Manel',  couleur: '#F9A8D4' },
  { membreId: 'membre-nawfel', nom: 'Nawfel', prenom: 'Nawfel', couleur: '#86EFAC' },
];
