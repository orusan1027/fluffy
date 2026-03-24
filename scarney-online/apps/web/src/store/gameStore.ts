import { create } from 'zustand';
import { emitAck } from '../lib/socket.js';
import type { PersonalGameState, HandResult, ActionType } from '@scarney/shared';

interface GameState {
  gameState: PersonalGameState | null;
  lastResult: HandResult | null;
  showResult: boolean;
  error: string | null;

  applyGameState: (state: PersonalGameState) => void;
  applyResult: (result: HandResult) => void;
  dismissResult: () => void;
  sendAction: (roomId: string, type: ActionType, amount?: number) => Promise<void>;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  gameState: null,
  lastResult: null,
  showResult: false,
  error: null,

  applyGameState: (state) => set({ gameState: state, showResult: false }),

  applyResult: (result) => set({ lastResult: result, showResult: true }),

  dismissResult: () => set({ showResult: false }),

  sendAction: async (roomId, type, amount) => {
    try {
      await emitAck<void>('game:action', { roomId, action: { type, amount } });
    } catch (e: unknown) {
      set({ error: (e as Error).message });
    }
  },

  reset: () => set({ gameState: null, lastResult: null, showResult: false, error: null }),
}));
