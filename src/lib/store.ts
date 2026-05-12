import { create } from "zustand";
import { User } from "firebase/auth";

export type Theme = "terminal" | "amber" | "win98" | "cyber" | "cassette";

interface AppState {
  user: User | null;
  profile: UserProfile | null;
  theme: Theme;
  soundEnabled: boolean;
  crtEnabled: boolean;
  isInitializing: boolean;

  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setTheme: (theme: Theme) => void;
  toggleSound: () => void;
  toggleCrt: () => void;
  setInitializing: (val: boolean) => void;
}

export interface UserProfile {
  uid: string;
  username: string;
  photoUrl: string | null;
  status: "online" | "offline";
  lastSeen: number;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  profile: null,
  theme: "terminal",
  soundEnabled: true,
  crtEnabled: true,
  isInitializing: true,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setTheme: (theme) => set({ theme }),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
  toggleCrt: () => set((state) => ({ crtEnabled: !state.crtEnabled })),
  setInitializing: (val) => set({ isInitializing: val }),
}));
