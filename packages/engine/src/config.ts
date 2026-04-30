/**
 * @fileoverview config.ts
 *
 * Single source of truth for the slot machine grid configuration.
 *
 * Changing these constants and rebuilding the project allows the engine
 * to support any N×M grid without touching business logic.
 *
 * @example Change to a 5×5 grid:
 *   rows: 5,
 *   cols: 5,
 *   minMatch: 3,
 *   numSymbols: 7,
 *   stripSize: 100,
 *   paylineSymbols: 5,
 *
 * Then regenerate reel strips:
 *   npx tsx scripts/generateReelStrips.ts
 */

/**
 * Grid configuration constants.
 *
 * All dimensions are compile-time constants so the bundler can dead-code
 * eliminate unused paths and the JIT can inline loop bounds.
 */
export const GRID_CONFIG = {
  /** Number of rows (vertical cells displayed per reel). */
  rows: 4,
  /** Number of columns (reels). */
  cols: 4,
  /** Minimum contiguous symbols required for a payline to count as a match. */
  minMatch: 3,
  /** Total symbol types (Ten, Jack, Queen, King, Ace, Wild, Bonus). */
  numSymbols: 7,
  /** Size of each reel strip (must be ≥ 1). */
  stripSize: 100,
  /**
   * Number of symbols that can form payline matches.
   * Ten through Ace = 5. Wild and Bonus are special-cased.
   */
  paylineSymbols: 5,
} as const;

/** Read-only type derived from {@link GRID_CONFIG}. */
export type GridConfig = typeof GRID_CONFIG;
