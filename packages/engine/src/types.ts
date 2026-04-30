/**
 * @fileoverview types.ts
 *
 * Core type definitions for the slot machine engine.
 *
 * All dimensions (NUM_ROWS, NUM_REELS) are re-exported from {@link config}
 * so the entire codebase stays in sync with a single compile-time change.
 */

import { GRID_CONFIG } from './config';

/**
 * Enumeration of all slot symbols.
 *
 * Numeric values are ordered from lowest-paying (Ten=0) to highest-paying
 * (Ace=4). Wild (5) is a special symbols.
 *
 * The ordering matters for the greedy wild-matching algorithm in
 * {@link PayoutEngine}, which iterates from high to low.
 */
export enum Symbol {
  Ten = 0,
  Jack = 1,
  Queen = 2,
  King = 3,
  Ace = 4,
  Wild = 5,
}

/**
 * Emoji mapping for each symbol. Used by the web frontend for display.
 */
export const SYMBOL_EMOJIS: Record<Symbol, string> = {
  [Symbol.Ten]: '🔟',
  [Symbol.Jack]: '👦',
  [Symbol.Queen]: '👸',
  [Symbol.King]: '👑',
  [Symbol.Ace]: '🅰️',
  [Symbol.Wild]: '🃏',
};

/** Re-exported from {@link GRID_CONFIG} for backward compatibility. */
export const NUM_ROWS = GRID_CONFIG.rows;
/** Re-exported from {@link GRID_CONFIG} for backward compatibility. */
export const NUM_REELS = GRID_CONFIG.cols;
/** Re-exported from {@link GRID_CONFIG} for backward compatibility. */
export const NUM_SYMBOLS = GRID_CONFIG.numSymbols;

/**
 * A single cell coordinate on the slot grid.
 *
 * `row` ranges from 0 to {@link NUM_ROWS}-1 (top to bottom).
 * `col` ranges from 0 to {@link NUM_REELS}-1 (left to right).
 */
export interface Coordinate {
  row: number;
  col: number;
}

/**
 * Result of a single spin. The server generates this; the client only renders it.
 */
export interface SpinResult {
  /** N×M grid of symbols. */
  symbols: Symbol[][];
  /**
   * For each payline symbol (Ten–Ace), a copy of the grid where every
   * {@link Symbol.Wild} is replaced by that symbol.
   */
  wildReplacements: Symbol[][][];
}

/**
 * A single payline path through the grid.
 *
 * Coordinates are ordered left-to-right by column, with exactly one cell
 * per column. Path length is always between {@link GRID_CONFIG.minMatch}
 * and {@link GRID_CONFIG.cols} inclusive.
 */
export interface PaylinePath {
  coordinates: Coordinate[];
}

/**
 * Payout result returned by {@link PayoutEngine.calculatePayout}.
 */
export interface PayoutResult {
  /** Total winnings = bet × multiplier. */
  winnings: number;
  /** Sum of all matching payline multipliers. */
  multiplier: number;
  /** Detailed list of every winning path that contributed. */
  winningPaths: { symbol: Symbol; size: number; coordinates: Coordinate[] }[];
}

/**
 * GraphQL-safe string names for each {@link Symbol}.
 *
 * GraphQL enums cannot use numeric values, so the API serializes
 * symbols as these uppercase strings.
 */
export const GRAPHQL_SYMBOL_NAMES: Record<Symbol, string> = {
  [Symbol.Ten]: 'TEN',
  [Symbol.Jack]: 'JACK',
  [Symbol.Queen]: 'QUEEN',
  [Symbol.King]: 'KING',
  [Symbol.Ace]: 'ACE',
  [Symbol.Wild]: 'WILD',
};

/**
 * Emoji mapping keyed by GraphQL symbol name (e.g. "TEN" → "🔟").
 *
 * This is the single source of truth for frontend display.
 */
export const GRAPHQL_EMOJIS: Record<string, string> = {
  TEN: '🔟',
  JACK: '👦',
  QUEEN: '👸',
  KING: '👑',
  ACE: '🅰️',
  WILD: '🃏',
};

/**
 * Convert a grid of {@link Symbol} enums to GraphQL string names.
 *
 * @param symbols - N×M grid of numeric enum values
 * @returns N×M grid of uppercase string names (e.g. "TEN")
 */
export function symbolsToGraphQL(symbols: Symbol[][]): string[][] {
  return symbols.map((row) => row.map((s) => GRAPHQL_SYMBOL_NAMES[s]));
}
