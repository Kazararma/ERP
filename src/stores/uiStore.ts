import { create } from 'zustand';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  resolve: ((value: boolean) => void) | null;
}

interface UiState {
  sidebarOpen: boolean;
  activeTab: string;
  confirmDialog: ConfirmDialogState;
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
  requestConfirm: (title: string, message: string) => Promise<boolean>;
  resolveConfirm: (result: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  activeTab: 'bought',
  confirmDialog: {
    isOpen: false,
    title: '',
    message: '',
    resolve: null,
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  requestConfirm: (title, message) => {
    return new Promise<boolean>((resolve) => {
      set({
        confirmDialog: {
          isOpen: true,
          title,
          message,
          resolve,
        },
      });
    });
  },
  resolveConfirm: (result) => {
    set((state) => {
      if (state.confirmDialog.resolve) {
        state.confirmDialog.resolve(result);
      }
      return {
        confirmDialog: {
          ...state.confirmDialog,
          isOpen: false,
          resolve: null,
        },
      };
    });
  },
}));
