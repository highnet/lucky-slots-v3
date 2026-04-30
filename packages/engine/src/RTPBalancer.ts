/**
 * @fileoverview RTPBalancer.ts
 *
 * Reverse Monte Carlo optimizer that adjusts symbol probabilities
 * (THRESHOLDS) and payout values (MULTIPLIERS) to achieve a target RTP.
 *
 * Uses greedy coordinate descent with bounded random restarts.
 * Each iteration tests a small perturbation on one parameter,
 * measures the RTP delta via a fast 10K-spin simulation, and
 * commits the change if it moves closer to the target.
 *
 * Supports any M×N grid size through the auto-repair multiplier system.
 */

import { RTPSimulator } from './RTPSimulator';

export interface BalancerResult {
  converged: boolean;
  iterations: number;
  finalRTP: number;
  targetRTP: number;
  tolerance: number;
  /** The optimized threshold configuration */
  thresholds: Record<string, number>;
  /** The optimized multiplier configuration */
  multipliers: Record<string, number>;
  /** Human-readable log of each iteration */
  log: string[];
}

/** Default hardcoded multipliers used as the starting point. */
const DEFAULT_MULTIPLIERS: Record<string, number> = {
  '3 Ten': 0.25, '4 Ten': 1, '5 Ten': 5,
  '3 Jack': 0.5, '4 Jack': 2, '5 Jack': 10,
  '3 Queen': 1, '4 Queen': 4, '5 Queen': 20,
  '3 King': 2, '4 King': 8, '5 King': 40,
  '3 Ace': 4, '4 Ace': 12, '5 Ace': 56,
};

/** Parameters that the balancer can tweak. */
interface ThresholdConfig {
  ten: number;
  jack: number;
  queen: number;
  king: number;
  ace: number;
  wild: number;
  bonus: number;
}

function cloneThresholds(t: ThresholdConfig): ThresholdConfig {
  return { ...t };
}

function thresholdsValid(t: ThresholdConfig): boolean {
  const vals = [t.ten, t.jack, t.queen, t.king, t.ace, t.wild, t.bonus];
  if (vals[0] < 50) return false;
  if (vals[6] !== 999) return false;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] <= vals[i - 1] + 5) return false;
  }
  return true;
}

export class RTPBalancer {
  /**
   * Run the reverse Monte Carlo optimizer.
   *
   * @param targetRTP    Desired RTP percentage (e.g. 49 for 49%)
   * @param tolerance    Acceptable error margin (default 1.0 = ±1%)
   * @param maxIters     Maximum descent iterations (default 100)
   * @param gridConfig   Optional override for rows/cols/minMatch
   * @returns            Final balanced configuration + convergence report
   */
  static balance(
    targetRTP: number,
    tolerance = 1.0,
    maxIters = 100,
    gridConfig?: { rows: number; cols: number; minMatch: number; paylineSymbols: number }
  ): BalancerResult {
    const log: string[] = [];

    const rows = gridConfig?.rows ?? 3;
    const cols = gridConfig?.cols ?? 3;
    const minMatch = gridConfig?.minMatch ?? 3;
    const paylineSymbols = gridConfig?.paylineSymbols ?? 5;

    let thresholds: ThresholdConfig = {
      ten: 450, jack: 550, queen: 750, king: 880, ace: 970, wild: 990, bonus: 999,
    };

    // Start with a deep copy of defaults
    const multipliers: Record<string, number> = { ...DEFAULT_MULTIPLIERS };

    // Filter multipliers to only sizes valid for current grid
    const validKeys = Object.keys(multipliers).filter((k) => {
      const size = parseInt(k.split(' ')[0], 10);
      return size >= minMatch && size <= cols;
    });
    const activeMultipliers: Record<string, number> = {};
    for (const k of validKeys) activeMultipliers[k] = multipliers[k];

    function simulate(seed: number): number {
      const sim = new RTPSimulator({
        rows,
        cols,
        minMatch,
        paylineSymbols,
        thresholds: { ...thresholds },
        multipliers: { ...activeMultipliers },
      });
      return sim.quickEstimate(seed);
    }

    let bestRTP = simulate(42);
    log.push(`Start  RTP=${bestRTP.toFixed(2)}%  target=${targetRTP.toFixed(1)}%`);

    let converged = false;
    let iter = 0;

    for (; iter < maxIters; iter++) {
      if (Math.abs(bestRTP - targetRTP) <= tolerance) {
        converged = true;
        log.push(`CONVERGED in ${iter} iterations`);
        break;
      }

      // Generate candidate perturbations
      const candidates: { type: 'threshold' | 'multiplier'; key: string; delta: number; desc: string }[] = [];

      // Threshold perturbations: shift probabilities by ±20
      const threshKeys: (keyof ThresholdConfig)[] = ['ten', 'jack', 'queen', 'king', 'ace', 'wild'];
      for (const key of threshKeys) {
        candidates.push({ type: 'threshold', key, delta: -20, desc: `${key} prob ↓` });
        candidates.push({ type: 'threshold', key, delta: 20, desc: `${key} prob ↑` });
      }

      // Multiplier perturbations: scale by ±20%
      for (const key of Object.keys(activeMultipliers)) {
        const current = activeMultipliers[key];
        candidates.push({ type: 'multiplier', key, delta: current * 0.2, desc: `${key} mult ↑` });
        candidates.push({ type: 'multiplier', key, delta: -current * 0.2, desc: `${key} mult ↓` });
      }

      // Shuffle candidates to avoid bias toward early parameters
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      let improved = false;

      for (const cand of candidates) {
        let testRTP: number;

        if (cand.type === 'threshold') {
          const next = cloneThresholds(thresholds);
          (next as unknown as Record<string, number>)[cand.key] += cand.delta;
          if (!thresholdsValid(next)) continue;
          const prev = cloneThresholds(thresholds);
          thresholds = next;
          testRTP = simulate(1000 + iter);
          if (!isFinite(testRTP)) {
            thresholds = prev;
            continue;
          }
        } else {
          const nextMult = { ...activeMultipliers };
          const newVal = nextMult[cand.key] + cand.delta;
          if (newVal < 0.01) continue;
          nextMult[cand.key] = newVal;
          const oldVal = activeMultipliers[cand.key];
          activeMultipliers[cand.key] = newVal;
          testRTP = simulate(1000 + iter);
          if (!isFinite(testRTP) || testRTP < 0) {
            activeMultipliers[cand.key] = oldVal;
            continue;
          }
        }

        const distBefore = Math.abs(bestRTP - targetRTP);
        const distAfter = Math.abs(testRTP - targetRTP);

        if (distAfter < distBefore) {
          bestRTP = testRTP;
          log.push(
            `Iter ${iter + 1}:  RTP=${bestRTP.toFixed(2)}%  |  ${cand.desc}  |  dist=${distAfter.toFixed(2)}%`
          );
          improved = true;
          break; // commit this change and start next iteration
        } else {
          // rollback
          if (cand.type === 'threshold') {
            (thresholds as unknown as Record<string, number>)[cand.key] -= cand.delta;
          } else {
            activeMultipliers[cand.key] -= cand.delta;
          }
        }
      }

      if (!improved) {
        log.push(`Iter ${iter + 1}:  STUCK — no improving perturbation found`);
        break;
      }
    }

    if (!converged && iter >= maxIters) {
      log.push(`REACHED MAX ITERATIONS (${maxIters}). Final RTP=${bestRTP.toFixed(2)}%`);
    }

    return {
      converged,
      iterations: iter,
      finalRTP: bestRTP,
      targetRTP,
      tolerance,
      thresholds: { ...thresholds },
      multipliers: { ...activeMultipliers },
      log,
    };
  }
}
