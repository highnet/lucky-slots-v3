/**
 * @fileoverview PayoutEngine.ts
 *
 * Calculates winnings by matching spin results against payline paths.
 *
 * Algorithm (high-level):
 * 1. For each payline symbol (Ace → Ten), check every path against the
 *    corresponding wild-replaced grid.
 * 2. Group successful paths by length (3, 4, 5, …).
 * 3. Filter "dirty" subpaths: a 4-match fully contained in a 5-match is removed.
 *    This is done with BigInt bitmasks for O(1) containment checks.
 * 4. Remove paths that would reuse a wild already "spent" by a higher-value match.
 * 5. Sum multipliers from the remaining clean paths.
 *
 * Bitmask details:
 * Each cell gets a bit position = row * cols + col.
 * A path's mask = OR of all its cell bits.
 * Containment: (superMask & subMask) === subMask  →  subPath is fully inside superPath.
 */

import { Symbol, type Coordinate, type PayoutResult, NUM_REELS } from './types';
import { getMultiplier } from './constants';
import { GRID_CONFIG } from './config';
import type { PaylineEngine } from './PaylineEngine';

/**
 * Build a BigInt bitmask for a path.
 * Each cell gets bit position = row * cols + col.
 */
function pathToMask(path: Coordinate[], cols: number): bigint {
  let mask = 0n;
  for (const c of path) {
    mask |= 1n << BigInt(c.row * cols + c.col);
  }
  return mask;
}

/**
 * Check if subPath is fully contained in superPath using bitmasks.
 */
function isContained(superMask: bigint, subMask: bigint): boolean {
  return (superMask & subMask) === subMask;
}

export class PayoutEngine {
  private paylineEngine: PaylineEngine;
  private cols: number;

  constructor(paylineEngine: PaylineEngine) {
    this.paylineEngine = paylineEngine;
    this.cols = NUM_REELS;
  }

  /**
   * Calculate the total payout for a spin.
   *
   * @param originalSymbols   Grid with wilds intact (used to track spent wilds)
   * @param wildReplacements  Array of grids where wilds are replaced per symbol
   * @param bet               Current bet amount
   * @returns Winnings, multiplier, and detailed winning paths
   */
  calculatePayout(
    originalSymbols: Symbol[][],
    wildReplacements: Symbol[][][],
    bet: number
  ): PayoutResult {
    const totalPaths = this.paylineEngine.getPaths();
    const payoutTallies: string[] = [];
    const winningPaths: { symbol: Symbol; size: number; coordinates: Coordinate[] }[] = [];

    let spentWildsMask = 0n;
    const { paylineSymbols } = GRID_CONFIG;

    // Flat array: matches[symbolID] = list of { coordinates, mask }
    const matches: { coordinates: Coordinate[]; mask: bigint }[][] = Array.from(
      { length: paylineSymbols },
      () => []
    );

    // Step 1: Find all matching paths for each symbol (highest first)
    for (let symbolID = paylineSymbols - 1; symbolID >= 0; symbolID--) {
      const scanSymbol = symbolID as Symbol;
      const spinnedSymbols = wildReplacements[symbolID];

      for (const path of totalPaths) {
        let pathSuccess = true;
        for (const coord of path.coordinates) {
          if (spinnedSymbols[coord.row][coord.col] !== scanSymbol) {
            pathSuccess = false;
            break;
          }
        }
        if (pathSuccess) {
          matches[symbolID].push({
            coordinates: path.coordinates,
            mask: pathToMask(path.coordinates, this.cols),
          });
        }
      }
    }

    // Step 2–4: Filter dirty subpaths and spent wilds, then tally
    for (let symbolID = paylineSymbols - 1; symbolID >= 0; symbolID--) {
      const scanSymbol = symbolID as Symbol;
      const symbolMatches = matches[symbolID];

      // Group by path length
      const bySize = new Map<number, { coordinates: Coordinate[]; mask: bigint }[]>();
      for (const m of symbolMatches) {
        const list = bySize.get(m.coordinates.length) ?? [];
        list.push(m);
        bySize.set(m.coordinates.length, list);
      }

      const sizes = Array.from(bySize.keys()).sort((a, b) => b - a);

      // Precompute masks per size for fast dirty-path checks
      const sizeMasks = new Map<number, bigint[]>();
      for (const size of sizes) {
        sizeMasks.set(size, bySize.get(size)!.map((m) => m.mask));
      }

      // Remove dirty subpaths
      const validPaths: { coordinates: Coordinate[]; mask: bigint }[] = [];
      for (const size of sizes) {
        const paths = bySize.get(size)!;
        const dirty = new Set<number>();

        for (const largerSize of sizes) {
          if (largerSize <= size) continue;
          const largerMasks = sizeMasks.get(largerSize)!;
          for (let i = 0; i < paths.length; i++) {
            if (dirty.has(i)) continue;
            for (const lm of largerMasks) {
              if (isContained(lm, paths[i].mask)) {
                dirty.add(i);
                break;
              }
            }
          }
        }

        for (let i = 0; i < paths.length; i++) {
          if (!dirty.has(i)) {
            validPaths.push(paths[i]);
          }
        }
      }

      // Remove paths that reuse already-spent wilds
      const finalPaths: { coordinates: Coordinate[]; mask: bigint }[] = [];
      for (const p of validPaths) {
        if ((p.mask & spentWildsMask) === 0n) {
          finalPaths.push(p);
        }
      }

      // Mark wilds in final paths as spent
      for (const p of finalPaths) {
        for (const coord of p.coordinates) {
          if (originalSymbols[coord.row][coord.col] === Symbol.Wild) {
            spentWildsMask |= 1n << BigInt(coord.row * this.cols + coord.col);
          }
        }
      }

      // Build tallies
      for (const p of finalPaths) {
        payoutTallies.push(`${p.coordinates.length} ${Symbol[scanSymbol]}`);
        winningPaths.push({
          symbol: scanSymbol,
          size: p.coordinates.length,
          coordinates: p.coordinates,
        });
      }
    }

    let multiplier = 0;
    for (const tally of payoutTallies) {
      const m = tally.match(/^(\d+)\s+(.+)$/);
      if (m) {
        const size = parseInt(m[1], 10);
        const symName = m[2];
        multiplier += getMultiplier(size, symName);
      }
    }

    const winnings = bet * multiplier;

    return {
      winnings,
      multiplier,
      winningPaths,
    };
  }
}
