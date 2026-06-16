/**
 * FAMILY OS — Store UI Module Famille
 * État éphémère uniquement — source de vérité = Dexie
 */

import { create } from 'zustand';
import type { OngletFamille, VueCalendrier } from '../types/familleTypes';

interface FamilleStore {
  // Navigation
  ongletActif: OngletFamille;
  setOngletActif: (tab: OngletFamille) => void;

  // Calendrier
  vueCalendrier: VueCalendrier;
  setVueCalendrier: (vue: VueCalendrier) => void;
  dateSelectionnee: string; // "YYYY-MM-DD"
  setDateSelectionnee: (date: string) => void;

  // Modals / Drawers
  evenementDetailId: string | null;
  setEvenementDetailId: (id: string | null) => void;
  formEvenementOuvert: boolean;
  setFormEvenementOuvert: (open: boolean) => void;
  editEvenementId: string | null;
  setEditEvenementId: (id: string | null) => void;

  reunionDetailId: string | null;
  setReunionDetailId: (id: string | null) => void;
  formReunionOuvert: boolean;
  setFormReunionOuvert: (open: boolean) => void;

  souvenirDetailId: string | null;
  setSouvenirDetailId: (id: string | null) => void;
  formSouvenirOuvert: boolean;
  setFormSouvenirOuvert: (open: boolean) => void;
  editSouvenirId: string | null;
  setEditSouvenirId: (id: string | null) => void;

  // Filtres Souvenirs
  filtreMembreSouvenir: string | null;
  setFiltreMembreSouvenir: (id: string | null) => void;
  filtreTypeSouvenir: string | null;
  setFiltreTypeSouvenir: (type: string | null) => void;
}

const today = new Date().toISOString().slice(0, 10);

export const useFamilleStore = create<FamilleStore>((set) => ({
  ongletActif: 'membres',
  setOngletActif: (tab) => set({ ongletActif: tab }),

  vueCalendrier: 'semaine',
  setVueCalendrier: (vue) => set({ vueCalendrier: vue }),
  dateSelectionnee: today,
  setDateSelectionnee: (date) => set({ dateSelectionnee: date }),

  evenementDetailId: null,
  setEvenementDetailId: (id) => set({ evenementDetailId: id }),
  formEvenementOuvert: false,
  setFormEvenementOuvert: (open) => set({ formEvenementOuvert: open, editEvenementId: open ? null : null }),
  editEvenementId: null,
  setEditEvenementId: (id) => set({ editEvenementId: id, formEvenementOuvert: id !== null }),

  reunionDetailId: null,
  setReunionDetailId: (id) => set({ reunionDetailId: id }),
  formReunionOuvert: false,
  setFormReunionOuvert: (open) => set({ formReunionOuvert: open }),

  souvenirDetailId: null,
  setSouvenirDetailId: (id) => set({ souvenirDetailId: id }),
  formSouvenirOuvert: false,
  setFormSouvenirOuvert: (open) => set({ formSouvenirOuvert: open, editSouvenirId: open ? null : null }),
  editSouvenirId: null,
  setEditSouvenirId: (id) => set({ editSouvenirId: id, formSouvenirOuvert: id !== null }),

  filtreMembreSouvenir: null,
  setFiltreMembreSouvenir: (id) => set({ filtreMembreSouvenir: id }),
  filtreTypeSouvenir: null,
  setFiltreTypeSouvenir: (type) => set({ filtreTypeSouvenir: type }),
}));
