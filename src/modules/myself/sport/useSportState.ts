import { useState, useEffect, useCallback } from 'react';
import type { SportState } from './sportTypes';

const STORAGE_KEY = 'sport_transfo_v1';

const DEFAULT_STATE: SportState = {
  profil: {
    nom: 'Hafida',
    dateDepart: new Date().toISOString().split('T')[0],
    poidsInitial: 68,
    tailleInitiale: 76,
    hanchesInitiales: 106,
    poidsObjectif: 65,
  },
  mensurations: [],
  journalEntries: [],
  nutritionToday: { foods: [], water: 0 },
  nutritionMode: 'recomposition',
  diastasisToday: { vacuum: false, respiration: false, deadBug: false, birdDog: false, heelSlides: false },
  diastasisLogs: [],
  objectifs: {
    '3': [
      { id: '3-1', text: 'Routine installée', done: false },
      { id: '3-2', text: 'Vacuum quotidien', done: false },
      { id: '3-3', text: 'Amélioration posture', done: false },
      { id: '3-4', text: 'Début développement fessiers', done: false },
    ],
    '6': [
      { id: '6-1', text: 'Transformation visible', done: false },
      { id: '6-2', text: 'Tour de taille réduit', done: false },
      { id: '6-3', text: 'Fessiers plus galbés', done: false },
    ],
    '12': [
      { id: '12-1', text: 'Fessiers nettement plus développés', done: false },
      { id: '12-2', text: 'Cuisses plus volumineuses', done: false },
      { id: '12-3', text: 'Silhouette plus sablier', done: false },
    ],
    '24': [
      { id: '24-1', text: 'Potentiel naturel avancé', done: false },
      { id: '24-2', text: 'Transformation majeure', done: false },
    ],
  },
  planning: {},
  visionBoard: [
    { id: 'v1', type: 'quote', text: '"Le corps accomplit ce que l\'esprit croit."', color: '#EAE5FF' },
    { id: 'v2', type: 'quote', text: '"Chaque séance te rapproche de ton meilleur toi."', color: '#C4B5FD' },
    { id: 'v3', type: 'quote', text: '"La discipline crée la liberté."', color: '#FBD0E8' },
    { id: 'v4', type: 'quote', text: '"24 mois. Une transformation. Hafida."', color: '#EAE5FF' },
  ],
  victoires: [],
  gluteMetrics: { grand: 0, moyen: 0, superieur: 0 },
  photos: {},
};

export function useSportState() {
  const [state, setState] = useState<SportState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SportState>;
        return {
          ...DEFAULT_STATE,
          ...saved,
          profil: { ...DEFAULT_STATE.profil, ...(saved.profil ?? {}) },
          objectifs: { ...DEFAULT_STATE.objectifs, ...(saved.objectifs ?? {}) },
          nutritionToday: saved.nutritionToday ?? DEFAULT_STATE.nutritionToday,
          diastasisToday: saved.diastasisToday ?? DEFAULT_STATE.diastasisToday,
          gluteMetrics: saved.gluteMetrics ?? DEFAULT_STATE.gluteMetrics,
        };
      }
    } catch {
      // ignore parse errors
    }
    return DEFAULT_STATE;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const update = useCallback((patch: Partial<SportState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  return { state, update, setState };
}
