import { Symbol, type SpinResult, NUM_ROWS, NUM_REELS } from './types';
import { THRESHOLDS } from './constants';

export type RngFunction = () => number;

function defaultRng(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % 999;
  }
  // Fallback for environments without crypto (should not happen in Node 20+)
  return Math.floor(Math.random() * 999);
}

export class SpinEngine {
  private rng: RngFunction;

  constructor(rng: RngFunction = defaultRng) {
    this.rng = rng;
  }

  generateRoll(): Symbol[][] {
    const symbols: Symbol[][] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      symbols[row] = [];
      for (let col = 0; col < NUM_REELS; col++) {
        const rng = this.rng();
        let symbol: Symbol;
        if (rng < THRESHOLDS.ten) {
          symbol = Symbol.Ten;
        } else if (rng < THRESHOLDS.jack) {
          symbol = Symbol.Jack;
        } else if (rng < THRESHOLDS.queen) {
          symbol = Symbol.Queen;
        } else if (rng < THRESHOLDS.king) {
          symbol = Symbol.King;
        } else if (rng < THRESHOLDS.ace) {
          symbol = Symbol.Ace;
        } else if (rng < THRESHOLDS.wild) {
          symbol = Symbol.Wild;
        } else {
          symbol = Symbol.Bonus;
        }
        symbols[row][col] = symbol;
      }
    }
    return symbols;
  }

  replaceWilds(symbols: Symbol[][]): Symbol[][][] {
    const replacements: Symbol[][][] = [];
    for (let i = 0; i < 5; i++) {
      const grid: Symbol[][] = [];
      for (let row = 0; row < NUM_ROWS; row++) {
        grid[row] = [];
        for (let col = 0; col < NUM_REELS; col++) {
          if (symbols[row][col] === Symbol.Wild) {
            grid[row][col] = i as Symbol;
          } else {
            grid[row][col] = symbols[row][col];
          }
        }
      }
      replacements.push(grid);
    }
    return replacements;
  }

  spin(): SpinResult {
    const symbols = this.generateRoll();
    const wildReplacements = this.replaceWilds(symbols);
    return { symbols, wildReplacements };
  }
}
