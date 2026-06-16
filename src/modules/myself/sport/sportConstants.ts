import type { JourProgramme } from './sportTypes';

export const PROGRAMME: JourProgramme[] = [
  {
    id: 0, name: 'Fessiers Lourds', icon: '🍑', type: 'fessiers',
    exercises: [
      { name: 'Hip Thrust',            sets: 4, reps: 12, category: 'compound' },
      { name: 'Romanian Deadlift',     sets: 4, reps: 10, category: 'compound' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: 10, category: 'unilateral' },
      { name: 'Abduction',             sets: 4, reps: 25, category: 'isolation' },
    ],
  },
  {
    id: 1, name: 'Core & Posture', icon: '🫁', type: 'core',
    exercises: [
      { name: 'Vacuum',      sets: 3, reps: '10×5s',  category: 'core' },
      { name: 'Dead Bug',    sets: 3, reps: 10,        category: 'core' },
      { name: 'Bird Dog',    sets: 3, reps: 10,        category: 'core' },
      { name: 'Heel Slides', sets: 3, reps: 12,        category: 'core' },
      { name: 'Marche',      sets: 1, reps: '20 min',  category: 'cardio' },
    ],
  },
  {
    id: 2, name: 'Cuisses', icon: '🦵', type: 'cuisses',
    exercises: [
      { name: 'Goblet Squat', sets: 4, reps: 12, category: 'compound' },
      { name: 'Step Up',      sets: 3, reps: 12, category: 'unilateral' },
      { name: 'Fentes',       sets: 3, reps: 10, category: 'unilateral' },
      { name: 'Squat Pulse',  sets: 3, reps: 30, category: 'isolation' },
    ],
  },
  {
    id: 3, name: 'Repos actif', icon: '🌿', type: 'repos',
    exercises: [],
  },
  {
    id: 4, name: 'Fessiers Volume', icon: '✨', type: 'fessiers',
    exercises: [
      { name: 'Hip Thrust',   sets: 4, reps: 15, category: 'compound' },
      { name: 'Frog Pumps',   sets: 3, reps: 20, category: 'isolation' },
      { name: 'Glute Bridge', sets: 4, reps: 20, category: 'compound' },
      { name: 'Abduction',    sets: 3, reps: 30, category: 'isolation' },
      { name: 'Donkey Kicks', sets: 3, reps: 15, category: 'isolation' },
    ],
  },
  {
    id: 5, name: 'Ischios & Fessiers', icon: '💎', type: 'fessiers',
    exercises: [
      { name: 'Romanian Deadlift',            sets: 4, reps: 10, category: 'compound' },
      { name: 'Single Leg Romanian Deadlift', sets: 3, reps: 8,  category: 'unilateral' },
      { name: 'Hip Thrust Unilatéral',        sets: 3, reps: 10, category: 'unilateral' },
      { name: 'Abduction',                    sets: 4, reps: 20, category: 'isolation' },
    ],
  },
];

export const NUTRITION_MODES = {
  recomposition: {
    label: 'Recomposition',
    desc: 'Perdre gras, gagner muscle',
    kcal: 1800,
    prot: 140,
    glucides: 180,
    lipides: 55,
    color: '#A78BFA',
  },
  prise: {
    label: 'Prise de masse',
    desc: 'Maximiser le gain musculaire',
    kcal: 2100,
    prot: 150,
    glucides: 250,
    lipides: 65,
    color: '#F472B6',
  },
  maintien: {
    label: 'Maintien',
    desc: 'Stabiliser la composition',
    kcal: 1950,
    prot: 145,
    glucides: 215,
    lipides: 60,
    color: '#67E8F9',
  },
} as const;

export const GLUTE_TIMELINE = [
  { mois: 1,  label: 'Activation neuro-musculaire',   desc: 'Connexion esprit-muscle, bases posture' },
  { mois: 3,  label: 'Hypertrophie visible',           desc: 'Galbe supérieur plus marqué' },
  { mois: 6,  label: 'Transformation notable',         desc: 'Fessiers nettement plus ronds' },
  { mois: 9,  label: 'Volume significatif',            desc: 'Changement visible en photo' },
  { mois: 12, label: 'Résultats majeurs',              desc: 'Silhouette transformée' },
  { mois: 18, label: 'Potentiel intermédiaire atteint',desc: 'Maintenir, affiner, spécialiser' },
  { mois: 24, label: 'Potentiel naturel avancé',       desc: 'Transformation complète' },
];

export const TROPHIES = [
  { id: 'first_session',   icon: '🥇', name: 'Première séance',       desc: '1 séance enregistrée' },
  { id: 'week1',           icon: '📅', name: '7 jours',               desc: '1 semaine depuis le départ' },
  { id: 'sessions10',      icon: '🔥', name: '10 séances',            desc: '10 séances complétées' },
  { id: 'sessions25',      icon: '💪', name: '25 séances',            desc: '25 séances complétées' },
  { id: 'sessions50',      icon: '🏆', name: '50 séances',            desc: '50 séances complétées' },
  { id: 'hip_thrust_40',   icon: '🍑', name: 'Hip Thrust 40kg',       desc: 'Record Hip Thrust ≥ 40 kg' },
  { id: 'hip_thrust_60',   icon: '✨', name: 'Hip Thrust 60kg',       desc: 'Record Hip Thrust ≥ 60 kg' },
  { id: 'hip_thrust_80',   icon: '💎', name: 'Hip Thrust 80kg',       desc: 'Record Hip Thrust ≥ 80 kg' },
  { id: 'mensuration1',    icon: '📏', name: 'Première mesure',       desc: '1 mensuration enregistrée' },
  { id: 'mensuration5',    icon: '📊', name: 'Suivi régulier',        desc: '5 mensurations enregistrées' },
  { id: 'journal7',        icon: '📔', name: 'Journal tenu',          desc: '7 entrées journal' },
  { id: 'diastasis10',     icon: '🫁', name: 'Diastasis assidu',      desc: '10 séances diastasis' },
  { id: 'month3',          icon: '🌱', name: '3 mois',                desc: '3 mois depuis le départ' },
  { id: 'month6',          icon: '🌸', name: '6 mois',                desc: '6 mois depuis le départ' },
  { id: 'month12',         icon: '🌟', name: '1 an',                  desc: '1 an depuis le départ' },
  { id: 'month24',         icon: '👑', name: '2 ans — Projet accompli', desc: '24 mois de transformation' },
];

export const NAV_SECTIONS = [
  { label: 'Principal', items: [
    { id: 'dashboard',    icon: '🏠', label: 'Tableau de bord' },
    { id: 'objectifs',    icon: '🎯', label: 'Objectifs' },
    { id: 'photos',       icon: '📸', label: 'Photos Évolution' },
    { id: 'planning',     icon: '📅', label: 'Planificateur 24M' },
  ]},
  { label: 'Entraînement', items: [
    { id: 'programme',    icon: '🏋️', label: 'Programme' },
    { id: 'glutes',       icon: '✨', label: 'Projet Fessiers' },
    { id: 'diastasis',    icon: '🫁', label: 'Diastasis & Posture' },
  ]},
  { label: 'Suivi', items: [
    { id: 'nutrition',    icon: '🥗', label: 'Nutrition' },
    { id: 'mensurations', icon: '📏', label: 'Mensurations' },
    { id: 'journal',      icon: '📔', label: 'Journal' },
  ]},
  { label: 'Inspiration', items: [
    { id: 'visionboard',  icon: '🌸', label: 'Vision Board' },
    { id: 'analyse',      icon: '📊', label: 'Analyse & Trophées' },
  ]},
] as const;
