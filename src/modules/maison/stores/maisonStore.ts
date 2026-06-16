/**
 * FAMILY OS — maisonStore
 * src/modules/maison/stores/maisonStore.ts
 *
 * État UI éphémère uniquement — la source de vérité est Dexie.
 */

import { create } from 'zustand';

export type VueMaison = 'overview' | 'taches' | 'projets';

interface MaisonState {
  // Vue active du module
  vue: VueMaison;
  setVue: (v: VueMaison) => void;

  // Pièce sélectionnée (pour le drill-down)
  pieceActiveId: string | null;
  setPieceActiveId: (id: string | null) => void;

  // Projet sélectionné
  projetActifId: string | null;
  setProjetActifId: (id: string | null) => void;

  // Drawers
  drawerPieceOpen: boolean;
  drawerPieceEditId: string | null;
  openDrawerPiece: (editId?: string) => void;
  closeDrawerPiece: () => void;

  drawerTacheOpen: boolean;
  drawerTacheEditId: string | null;
  drawerTachePiecePrefill: string | null;
  drawerTacheProjetPrefill: string | null;
  drawerTacheFrequencePrefill: string | null;
  openDrawerTache: (opts?: { editId?: string; pieceId?: string; projetId?: string; frequence?: string }) => void;
  closeDrawerTache: () => void;

  drawerProjetOpen: boolean;
  drawerProjetEditId: string | null;
  openDrawerProjet: (editId?: string) => void;
  closeDrawerProjet: () => void;

  // Filtre tâches
  filtrePieceId: string | null;
  setFiltrePieceId: (id: string | null) => void;
  filtreStatut: 'toutes' | 'a_faire' | 'fait';
  setFiltreStatut: (s: 'toutes' | 'a_faire' | 'fait') => void;
}

export const useMaisonStore = create<MaisonState>((set) => ({
  vue: 'overview',
  setVue: (vue) => set({ vue }),

  pieceActiveId: null,
  setPieceActiveId: (id) => set({ pieceActiveId: id }),

  projetActifId: null,
  setProjetActifId: (id) => set({ projetActifId: id }),

  drawerPieceOpen: false,
  drawerPieceEditId: null,
  openDrawerPiece: (editId) => set({ drawerPieceOpen: true, drawerPieceEditId: editId ?? null }),
  closeDrawerPiece: () => set({ drawerPieceOpen: false, drawerPieceEditId: null }),

  drawerTacheOpen: false,
  drawerTacheEditId: null,
  drawerTachePiecePrefill: null,
  drawerTacheProjetPrefill: null,
  drawerTacheFrequencePrefill: null,
  openDrawerTache: (opts) => set({
    drawerTacheOpen: true,
    drawerTacheEditId: opts?.editId ?? null,
    drawerTachePiecePrefill: opts?.pieceId ?? null,
    drawerTacheProjetPrefill: opts?.projetId ?? null,
    drawerTacheFrequencePrefill: opts?.frequence ?? null,
  }),
  closeDrawerTache: () => set({
    drawerTacheOpen: false,
    drawerTacheEditId: null,
    drawerTachePiecePrefill: null,
    drawerTacheProjetPrefill: null,
    drawerTacheFrequencePrefill: null,
  }),

  drawerProjetOpen: false,
  drawerProjetEditId: null,
  openDrawerProjet: (editId) => set({ drawerProjetOpen: true, drawerProjetEditId: editId ?? null }),
  closeDrawerProjet: () => set({ drawerProjetOpen: false, drawerProjetEditId: null }),

  filtrePieceId: null,
  setFiltrePieceId: (id) => set({ filtrePieceId: id }),
  filtreStatut: 'a_faire',
  setFiltreStatut: (s) => set({ filtreStatut: s }),
}));
