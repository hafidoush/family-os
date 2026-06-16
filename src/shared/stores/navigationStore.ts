import { create } from 'zustand';
import type { ModuleOrigine } from '../types';

export type ModuleId = ModuleOrigine | 'parametres' | 'pensees' | 'routines';

interface ActiveContext {
  pieceId?: string;
  enfantId?: string;
}

interface NavigationState {
  activeModule: ModuleId;
  previousModule: ModuleId | null;
  activeContext: ActiveContext;
  setActiveModule: (id: ModuleId) => void;
  setActiveContext: (ctx: ActiveContext) => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  activeModule: 'dashboard',
  previousModule: null,
  activeContext: {},
  setActiveModule: (id) =>
    set({ previousModule: get().activeModule, activeModule: id }),
  setActiveContext: (ctx) => set({ activeContext: ctx }),
}));
