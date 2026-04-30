import { defineStore } from 'pinia';

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
  symbols: string[][];
  winningPaths: { symbol: string; size: number; coordinates: { row: number; col: number }[] }[];
  multiplier: number;
  winnings: number;
  bet: number;
  newBalance: number;
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
        this.balance = result.newBalance;
        this.winningPaths = result.winningPaths;
      }
    },
    resetWinningPaths() {
      this.winningPaths = [];
    },
  },
});
