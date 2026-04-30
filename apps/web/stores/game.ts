/**
 * @fileoverview stores/game.ts
 *
 * Pinia store for active game state.
 *
 * Tracks balance, bet, the current animation phase, the most recent spin
 * result, and any winning paths so the UI can highlight winning cells.
 */

import { defineStore } from 'pinia';

/** All possible UI animation phases for a single spin cycle. */
export type GamePhase =
  | 'idle'
  | 'spinning'
  | 'landing'
  | 'calculating'
  | 'showingPaylines'
  | 'showingWinners'
  | 'showingWinnings'
  | 'resetting';

export interface SpinResult {
  id: string;
  symbols: string[][];
  winningPaths: { symbol: string; size: number; coordinates: { row: number; col: number }[] }[];
  multiplier: number;
  winnings: number;
  bet: number;
  newBalance?: number;
  timestamp: string;
}

export const useGameStore = defineStore('game', {
  state: () => ({
    balance: 1000,
    bet: 0.1,
    phase: 'idle' as GamePhase,
    lastSpin: null as SpinResult | null,
    winningPaths: [] as { symbol: string; size: number; coordinates: { row: number; col: number }[] }[],
    isSpinning: false,
  }),
  actions: {
    setBalance(balance: number) {
      this.balance = balance;
    },
    setBet(bet: number) {
      this.bet = bet;
    },
    setPhase(phase: GamePhase) {
      this.phase = phase;
      this.isSpinning = phase === 'spinning' || phase === 'landing';
    },
    setLastSpin(result: SpinResult | null) {
      this.lastSpin = result;
      if (result) {
        this.balance = result.newBalance ?? this.balance;
        this.winningPaths = result.winningPaths;
      }
    },
    resetWinningPaths() {
      this.winningPaths = [];
    },
  },
});
