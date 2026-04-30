/**
 * @fileoverview SpinEngine.ts
 *
 * Generates the slot machine grid by sampling from physical reel strips.
 *
 * Each reel is an ordered array of symbol names. A spin picks a random
 * offset into each strip and reads the next N symbols vertically.
 *
 * After generation, wild symbols are expanded into N replacement grids
 * (one per payline symbol) so the payout engine can test each possibility.
 */

import { Symbol, type SpinResult, NUM_ROWS, NUM_REELS } from './types';
import { GRID_CONFIG } from './config';

/** Function signature for custom RNGs (useful for deterministic tests). */
export type RngFunction = () => number;

/** Default RNG: uses crypto.getRandomValues when available, falls back to Math.random. */
function defaultRng(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0];
  }
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

export class SpinEngine {
  private rng: RngFunction;
  private strips: string[][];
  private stringToSymbol: Record<string, Symbol>;

  constructor(rng: RngFunction = defaultRng, strips: string[][]) {
    this.rng = rng;
    this.strips = strips;
    this.stringToSymbol = {
      TEN: Symbol.Ten,
      JACK: Symbol.Jack,
      QUEEN: Symbol.Queen,
      KING: Symbol.King,
      ACE: Symbol.Ace,
      WILD: Symbol.Wild,
    };
  }

  /**
   * Generate a fresh N×M grid by sampling from reel strips.
   *
   * One RNG call per reel produces the vertical offset; the next N symbols
   * are read sequentially (wrapping around) to form that column.
   */
  generateRoll(): Symbol[][] {
    const symbols: Symbol[][] = [];
    for (let row = 0; row < NUM_ROWS; row++) {
      symbols[row] = [];
    }
    for (let col = 0; col < NUM_REELS; col++) {
      const strip = this.strips[col];
      const offset = this.rng() % strip.length;
      for (let row = 0; row < NUM_ROWS; row++) {
        const idx = (offset + row) % strip.length;
        symbols[row][col] = this.stringToSymbol[strip[idx]];
      }
    }
    return symbols;
  }

  /**
   * Expand wild symbols into N separate grids.
   *
   * For each payline symbol, creates a copy of the grid where
   * every {@link Symbol.Wild} is replaced by that symbol. This lets the
   * payout engine test each substitution independently.
   *
   * @param symbols - Original grid (may contain Wilds)
   * @returns Array of {@link GRID_CONFIG.paylineSymbols} grids
   */
  replaceWilds(symbols: Symbol[][]): Symbol[][][] {
    const replacements: Symbol[][][] = [];
    for (let i = 0; i < GRID_CONFIG.paylineSymbols; i++) {
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

  /**
   * Full spin: generate grid + wild replacements.
   */
  spin(): SpinResult {
    const symbols = this.generateRoll();
    const wildReplacements = this.replaceWilds(symbols);
    return { symbols, wildReplacements };
  }
}
