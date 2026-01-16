import { create } from "zustand";
import type { Game, GameModeKey, WagerTier } from "@shared/schema";

interface GameState {
  currentGame: Game | null;
  selectedMode: GameModeKey | null;
  selectedWager: WagerTier | null;
  isJoining: boolean;
  
  setSelectedMode: (mode: GameModeKey | null) => void;
  setSelectedWager: (wager: WagerTier | null) => void;
  setCurrentGame: (game: Game | null) => void;
  setIsJoining: (joining: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentGame: null,
  selectedMode: null,
  selectedWager: null,
  isJoining: false,

  setSelectedMode: (mode) => set({ selectedMode: mode }),
  setSelectedWager: (wager) => set({ selectedWager: wager }),
  setCurrentGame: (game) => set({ currentGame: game }),
  setIsJoining: (joining) => set({ isJoining: joining }),
  reset: () => set({
    currentGame: null,
    selectedMode: null,
    selectedWager: null,
    isJoining: false,
  }),
}));
