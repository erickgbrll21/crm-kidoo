import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Preferências de interface (não são dados de negócio). */
interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNav: (open: boolean) => void;
  newLeadOpen: boolean;
  setNewLead: (open: boolean) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileNavOpen: false,
      setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
      newLeadOpen: false,
      setNewLead: (newLeadOpen) => set({ newLeadOpen }),
    }),
    { name: 'kidoo-ui', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) },
  ),
);
