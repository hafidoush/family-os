import { create } from 'zustand';

type ActiveSheet = 'humeur' | null;

interface DashboardStore {
  activeSheet: ActiveSheet;
  humeurTargetMembreId: string | null;
  openHumeurSheet: (membreId: string) => void;
  closeSheet: () => void;
  weekViewOpen: boolean;
  toggleWeekView: () => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  activeSheet: null,
  humeurTargetMembreId: null,
  openHumeurSheet: (membreId) =>
    set({ activeSheet: 'humeur', humeurTargetMembreId: membreId }),
  closeSheet: () => set({ activeSheet: null, humeurTargetMembreId: null }),
  weekViewOpen: false,
  toggleWeekView: () => set((s) => ({ weekViewOpen: !s.weekViewOpen })),
}));