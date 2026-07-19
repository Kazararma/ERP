import { create } from 'zustand';
import { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  userDoc: any | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setUserDoc: (doc: any | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userDoc: null,
  loading: true,
  setUser: (user) => set({ user }),
  setUserDoc: (userDoc) => set({ userDoc }),
  setLoading: (loading) => set({ loading }),
}));
