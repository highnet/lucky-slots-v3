import { Symbol, type Coordinate, type PayoutResult } from './types';
import { MULTIPLIERS } from './constants';
import type { PaylineEngine } from './PaylineEngine';

export class PayoutEngine {
  private paylineEngine: PaylineEngine;

  constructor(paylineEngine: PaylineEngine) {
    this.paylineEngine = paylineEngine;
  }

  calculatePayout(
    originalSymbols: Symbol[][], // grid with wilds intact
    wildReplacements: Symbol[][][],
    bet: number
  ): PayoutResult {
    const totalPaths = this.paylineEngine.getPaths();
    const payoutTallies: string[] = [];
    const winningPaths: { symbol: Symbol; size: number; coordinates: Coordinate[] }[] = [];

    // Track which wild positions have been "spent" by higher-value matches
    const spentWilds = new Set<string>();

    // Process from highest symbol (Ace=4) down to lowest (Ten=0)
    for (let symbolID = 4; symbolID >= 0; symbolID--) {
      const scanSymbol = symbolID as Symbol;
      const spinnedSymbols = wildReplacements[symbolID];

      const matchedAnySize: Coordinate[][] = [];

      // Check all paths for this symbol replacement
      for (const path of totalPaths) {
        let pathSuccess = true;
        for (const coord of path.coordinates) {
          if (spinnedSymbols[coord.row][coord.col] !== scanSymbol) {
            pathSuccess = false;
            break;
          }
        }
        if (pathSuccess) {
          matchedAnySize.push(path.coordinates);
        }
      }

      // Categorize by size
      const matchedSize5: Coordinate[][] = [];
      const matchedSize4: Coordinate[][] = [];
      const matchedSize3: Coordinate[][] = [];

      for (const pathCoords of matchedAnySize) {
        if (pathCoords.length === 5) {
          matchedSize5.push(pathCoords);
        } else if (pathCoords.length === 4) {
          matchedSize4.push(pathCoords);
        } else if (pathCoords.length === 3) {
          matchedSize3.push(pathCoords);
        }
      }

      // Filter dirty subpaths (subpaths fully contained in larger paths)
      const dirtyPaths: Coordinate[][] = [];

      for (const path5 of matchedSize5) {
        for (const path4 of matchedSize4) {
          if (this.numberOfSharedVertices(path5, path4) === 4) {
            dirtyPaths.push(path4);
          }
        }
        for (const path3 of matchedSize3) {
          if (this.numberOfSharedVertices(path5, path3) === 3) {
            dirtyPaths.push(path3);
          }
        }
      }

      for (const path4 of matchedSize4) {
        for (const path3 of matchedSize3) {
          if (this.numberOfSharedVertices(path4, path3) === 3) {
            dirtyPaths.push(path3);
          }
        }
      }

      for (const dirtyPath of dirtyPaths) {
        const idx4 = matchedSize4.findIndex((p) => this.pathsEqual(p, dirtyPath));
        if (idx4 !== -1) matchedSize4.splice(idx4, 1);
        const idx3 = matchedSize3.findIndex((p) => this.pathsEqual(p, dirtyPath));
        if (idx3 !== -1) matchedSize3.splice(idx3, 1);
      }

      // Filter out paths that would require reusing already-spent wilds
      const isPathValid = (path: Coordinate[]): boolean => {
        for (const coord of path) {
          if (originalSymbols[coord.row][coord.col] === Symbol.Wild) {
            if (spentWilds.has(`${coord.row},${coord.col}`)) {
              return false;
            }
          }
        }
        return true;
      };

      const validSize5 = matchedSize5.filter(isPathValid);
      const validSize4 = matchedSize4.filter(isPathValid);
      const validSize3 = matchedSize3.filter(isPathValid);

      // Mark wilds in valid paths as spent so lower symbols can't reuse them
      const spendWilds = (paths: Coordinate[][]) => {
        for (const path of paths) {
          for (const coord of path) {
            if (originalSymbols[coord.row][coord.col] === Symbol.Wild) {
              spentWilds.add(`${coord.row},${coord.col}`);
            }
          }
        }
      };
      spendWilds(validSize5);
      spendWilds(validSize4);
      spendWilds(validSize3);

      // Build payout tallies and winning paths
      for (const path of validSize5) {
        payoutTallies.push(`${path.length} ${Symbol[scanSymbol]}`);
        winningPaths.push({ symbol: scanSymbol, size: 5, coordinates: path });
      }
      for (const path of validSize4) {
        payoutTallies.push(`${path.length} ${Symbol[scanSymbol]}`);
        winningPaths.push({ symbol: scanSymbol, size: 4, coordinates: path });
      }
      for (const path of validSize3) {
        payoutTallies.push(`${path.length} ${Symbol[scanSymbol]}`);
        winningPaths.push({ symbol: scanSymbol, size: 3, coordinates: path });
      }
    }

    let multiplier = 0;
    for (const tally of payoutTallies) {
      const add = MULTIPLIERS[tally];
      if (add !== undefined) {
        multiplier += add;
      }
    }

    const winnings = bet * multiplier;

    return {
      winnings,
      multiplier,
      winningPaths,
    };
  }

  private numberOfSharedVertices(path1: Coordinate[], path2: Coordinate[]): number {
    let shared = 0;
    for (const v1 of path1) {
      for (const v2 of path2) {
        if (v1.row === v2.row && v1.col === v2.col) {
          shared++;
          break;
        }
      }
    }
    return shared;
  }

  private pathsEqual(path1: Coordinate[], path2: Coordinate[]): boolean {
    if (path1.length !== path2.length) return false;
    for (let i = 0; i < path1.length; i++) {
      if (path1[i].row !== path2[i].row || path1[i].col !== path2[i].col) {
        return false;
      }
    }
    return true;
  }
}
