export type SportNavId =
  | 'dashboard' | 'objectifs' | 'photos' | 'planning'
  | 'programme' | 'seance' | 'glutes' | 'diastasis'
  | 'nutrition' | 'mensurations' | 'journal'
  | 'visionboard' | 'analyse';

export interface ExerciceDef {
  name: string;
  sets: number;
  reps: number | string;
  category: 'compound' | 'unilateral' | 'isolation' | 'core' | 'cardio';
}

export interface JourProgramme {
  id: number;
  name: string;
  icon: string;
  type: string;
  exercises: ExerciceDef[];
}

export interface SetLog { reps: string; weight: string; done: boolean; }
export interface ExerciceLog { name: string; sets: SetLog[]; }
export interface WorkoutMetriques { jourId: number; exercises: ExerciceLog[]; dureeSec?: number; }

export interface Mensuration {
  id: string;
  date: string;
  poids?: number;
  taille?: number;
  hanches?: number;
  cuisses?: number;
  poitrine?: number;
  bras?: number;
  mollets?: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  mood: string;
  energie: number;
  motivation: number;
  sommeil: number;
  texte: string;
  hasWorkout?: boolean;
}

export interface FoodItem {
  id: string;
  nom: string;
  kcal: number;
  prot: number;
  glucides: number;
  lipides: number;
}

export interface DiastasisChecklist {
  vacuum: boolean;
  respiration: boolean;
  deadBug: boolean;
  birdDog: boolean;
  heelSlides: boolean;
}

export interface DiastasisLog {
  id: string;
  date: string;
  checklist: DiastasisChecklist;
  largeur?: number;
  stabilite: number;
  posture: number;
  note: string;
}

export interface Objectif {
  id: string;
  text: string;
  done: boolean;
}

export interface PlanMonth {
  poids?: number;
  taille?: number;
  hanches?: number;
  hipThrust?: number;
  notes?: string;
}

export interface VisionItem {
  id: string;
  type: 'quote' | 'image';
  text?: string;
  color?: string;
  src?: string;
}

export interface Victoire {
  id: string;
  date: string;
  text: string;
}

export interface SportState {
  profil: {
    nom: string;
    dateDepart: string;
    poidsInitial: number;
    tailleInitiale: number;
    hanchesInitiales: number;
    poidsObjectif: number;
  };
  mensurations: Mensuration[];
  journalEntries: JournalEntry[];
  nutritionToday: { foods: FoodItem[]; water: number };
  nutritionMode: 'recomposition' | 'prise' | 'maintien';
  diastasisToday: DiastasisChecklist;
  diastasisLogs: DiastasisLog[];
  objectifs: Record<'3' | '6' | '12' | '24', Objectif[]>;
  planning: Record<number, PlanMonth>;
  visionBoard: VisionItem[];
  victoires: Victoire[];
  gluteMetrics: { grand: number; moyen: number; superieur: number };
  photos: Record<string, string>;
}
