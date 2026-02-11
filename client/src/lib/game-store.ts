import { create } from "zustand";
import type { Game, GameModeKey, WagerTier } from "@shared/schema";

interface GameState {
  currentGame: Game | null;
  selectedMode: GameModeKey | null;
  selectedWager: WagerTier | null;
  isJoining: boolean;
  playTab: "join" | "live";
  
  setSelectedMode: (mode: GameModeKey | null) => void;
  setSelectedWager: (wager: WagerTier | null) => void;
  setCurrentGame: (game: Game | null) => void;
  setIsJoining: (joining: boolean) => void;
  setPlayTab: (tab: "join" | "live") => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentGame: null,
  selectedMode: null,
  selectedWager: null,
  isJoining: false,
  playTab: "join",

  setSelectedMode: (mode) => set({ selectedMode: mode }),
  setSelectedWager: (wager) => set({ selectedWager: wager }),
  setCurrentGame: (game) => set({ currentGame: game }),
  setIsJoining: (joining) => set({ isJoining: joining }),
  setPlayTab: (tab) => set({ playTab: tab }),
  reset: () => set({
    currentGame: null,
    selectedMode: null,
    selectedWager: null,
    isJoining: false,
    playTab: "join",
  }),
}));
