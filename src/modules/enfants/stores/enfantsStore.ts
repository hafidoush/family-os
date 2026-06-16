import { create } from 'zustand';
import { db } from '../../../core/db/database';
import type { EnfantSection } from '../types';

interface EnfantsState {
  activeEnfantId: string | null;
  activeSection: EnfantSection;
  setActiveEnfant: (id: string) => void;
  setActiveSection: (section: EnfantSection) => void;
  initActiveEnfant: () => Promise<void>;
}

export const useEnfantsStore = create<EnfantsState>((set, get) => ({
  activeEnfantId: null,
  activeSection: 'activites',

  setActiveEnfant: (id) => set({ activeEnfantId: id }),
  setActiveSection: (section) => set({ activeSection: section }),

  initActiveEnfant: async () => {
    if (get().activeEnfantId) return;
    const premier = await db.membres
      .filter((m) => m.role === 'enfant' && m.actif)
      .first();
    if (premier) set({ activeEnfantId: premier.id });
  },
}));
