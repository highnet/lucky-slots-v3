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
   * @param targetRTP      Desired RTP percentage (e.g. 96 for 96%)
   * @param tolerance      Acceptable RTP error margin (default 1.0 = ±1%)
   * @param maxIters       Maximum descent iterations (default 100)
   * @param gridConfig     Optional override for rows/cols/minMatch
   * @param targetHitRate  Optional target hit-rate (0–1). When provided the
   *                       optimizer prefers threshold moves that reduce hit-rate
   *                       instead of slashing multipliers.
   * @returns              Final balanced configuration + convergence report
   */
  static balance(
    targetRTP: number,
    tolerance = 1.0,
    maxIters = 100,
    gridConfig?: { rows: number; cols: number; minMatch: number; paylineSymbols: number },
    targetHitRate?: number
  ): BalancerResult {
    const log: string[] = [];

    const rows = gridConfig?.rows ?? 3;
    const cols = gridConfig?.cols ?? 3;
    const minMatch = gridConfig?.minMatch ?? 3;
    const paylineSymbols = gridConfig?.paylineSymbols ?? 5;

    let thresholds: ThresholdConfig = {
      ten: 180, jack: 240, queen: 340, king: 400, ace: 450, wild: 470, bonus: 999,
    };

    // Start with a deep copy of defaults
    const baseMultipliers: Record<string, number> = { ...DEFAULT_MULTIPLIERS };

    // Filter multipliers to only sizes valid for current grid
    const validKeys = Object.keys(baseMultipliers).filter((k) => {
      const size = parseInt(k.split(' ')[0], 10);
      return size >= minMatch && size <= cols;
    });
    const activeMultipliers: Record<string, number> = {};
    for (const k of validKeys) activeMultipliers[k] = baseMultipliers[k];

    function simulate(seed: number): { rtp: number; hitRate: number } {
      const sim = new RTPSimulator({
        rows,
        cols,
        minMatch,
        paylineSymbols,
        thresholds: { ...thresholds },
        multipliers: { ...activeMultipliers },
      });
      const result = sim.run(10_000, 1.0, seed);
      return { rtp: result.rtp, hitRate: result.hitFrequency };
    }

    function loss(rtp: number, hitRate: number): number {
      const rtpErr = Math.abs(rtp - targetRTP);
      const hitErr = targetHitRate !== undefined ? Math.abs(hitRate - targetHitRate) * 100 : 0;
      return rtpErr + hitErr;
    }

    let bestSim = simulate(42);
    let bestLoss = loss(bestSim.rtp, bestSim.hitRate);
    log.push(
      `Start  RTP=${bestSim.rtp.toFixed(2)}%  hitRate=${(bestSim.hitRate * 100).toFixed(2)}%  ` +
        `targetRTP=${targetRTP.toFixed(1)}%  ${targetHitRate !== undefined ? `targetHit=${(targetHitRate * 100).toFixed(1)}%` : ''}`
    );

    let converged = false;
    let iter = 0;

    for (; iter < maxIters; iter++) {
      if (Math.abs(bestSim.rtp - targetRTP) <= tolerance) {
        if (targetHitRate === undefined || Math.abs(bestSim.hitRate - targetHitRate) <= 0.02) {
          converged = true;
          log.push(`CONVERGED in ${iter} iterations`);
          break;
        }
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
        // Strongly discourage multiplier reductions by only adding them when
        // no hit-rate target is set. When a hit-rate target exists we rely on
        // threshold changes to do the heavy lifting.
        if (targetHitRate === undefined) {
          candidates.push({ type: 'multiplier', key, delta: -current * 0.2, desc: `${key} mult ↓` });
        }
      }

      // Threshold candidates are tried first (they control hit-rate)
      const thresholdCands = candidates.filter((c) => c.type === 'threshold');
      const multCands = candidates.filter((c) => c.type === 'multiplier');

      // Shuffle within each group to avoid bias
      for (let i = thresholdCands.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [thresholdCands[i], thresholdCands[j]] = [thresholdCands[j], thresholdCands[i]];
      }
      for (let i = multCands.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [multCands[i], multCands[j]] = [multCands[j], multCands[i]];
      }

      // Try thresholds first, then multipliers as fallback
      const orderedCandidates = [...thresholdCands, ...multCands];

      let improved = false;

      for (const cand of orderedCandidates) {
        let testSim: { rtp: number; hitRate: number };
        const prevThresholds = cloneThresholds(thresholds);
        const prevMult = { ...activeMultipliers };

        if (cand.type === 'threshold') {
          const next = cloneThresholds(thresholds);
          (next as unknown as Record<string, number>)[cand.key] += cand.delta;
          if (!thresholdsValid(next)) continue;
          thresholds = next;
          testSim = simulate(1000 + iter);
          if (!isFinite(testSim.rtp)) {
            thresholds = prevThresholds;
            continue;
          }
        } else {
          const nextMult = { ...activeMultipliers };
          const newVal = nextMult[cand.key] + cand.delta;
          if (newVal < 0.01) continue;
          // Penalise multiplier reductions when a hit-rate target exists
          if (targetHitRate !== undefined && cand.delta < 0 && newVal < baseMultipliers[cand.key] * 0.8) {
            continue; // refuse to slash multipliers too far
          }
          nextMult[cand.key] = newVal;
          activeMultipliers[cand.key] = newVal;
          testSim = simulate(1000 + iter);
          if (!isFinite(testSim.rtp) || testSim.rtp < 0) {
            activeMultipliers[cand.key] = prevMult[cand.key];
            continue;
          }
        }

        const testLoss = loss(testSim.rtp, testSim.hitRate);

        if (testLoss < bestLoss) {
          bestSim = testSim;
          bestLoss = testLoss;
          log.push(
            `Iter ${iter + 1}:  RTP=${bestSim.rtp.toFixed(2)}%  hitRate=${(bestSim.hitRate * 100).toFixed(2)}%  |  ${cand.desc}  |  loss=${testLoss.toFixed(2)}`
          );
          improved = true;
          break; // commit this change and start next iteration
        } else {
          // rollback
          if (cand.type === 'threshold') {
            thresholds = prevThresholds;
          } else {
            activeMultipliers[cand.key] = prevMult[cand.key];
          }
        }
      }

      if (!improved) {
        log.push(`Iter ${iter + 1}:  STUCK — no improving perturbation found`);
        break;
      }
    }

    if (!converged && iter >= maxIters) {
      log.push(`REACHED MAX ITERATIONS (${maxIters}). Final RTP=${bestSim.rtp.toFixed(2)}%`);
    }

    return {
      converged,
      iterations: iter,
      finalRTP: bestSim.rtp,
      targetRTP,
      tolerance,
      thresholds: { ...thresholds },
      multipliers: { ...activeMultipliers },
      log,
    };
  }
}
