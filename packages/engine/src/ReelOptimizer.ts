/**
 * @fileoverview ReelOptimizer.ts
 *
 * Constrained stochastic optimizer that designs reel-strip layouts and
 * payout multipliers to achieve a target RTP **and** a target hit-rate.
 *
 * The optimizer works in two phases:
 *   1. Strip phase   – moves symbols between reels and swaps positions to
 *                      lower hit-rate (alignment penalty) while keeping
 *                      clusters low.
 *   2. Multiplier phase – scales individual multipliers up/down so the
 *                      final RTP matches the target despite the lower
 *                      hit-rate.
 *
 * Why two phases?
 *   Separating layout from payout makes the search space tractable.
 *
 * Usage:
 *   import { ReelOptimizer } from './ReelOptimizer';
 *   const result = ReelOptimizer.optimize({
 *     targetRTP: 95,
 *     targetHitRate: 0.12,
 *     baseMultipliers: { '3 Ten': 0.25, '4 Ten': 1, ... },
 *   });
 */

import { PaylineEngine } from './PaylineEngine';
import { PayoutEngine } from './PayoutEngine';
import { Symbol } from './types';
import { GRID_CONFIG } from './config';
import { getMultiplier } from './constants';

export interface ReelOptimizerConfig {
  rows?: number;
  cols?: number;
  minMatch?: number;
  paylineSymbols?: number;
  stripSize?: number;
  targetRTP: number;
  targetHitRate: number;
  baseMultipliers: Record<string, number>;
  /** Spins used for each inner-loop evaluation (default 5_000). */
  spinsPerEval?: number;
  /** Total simulated-annealing iterations (default 200). */
  iterations?: number;
  /** Starting temperature (default 2.0). */
  temperature?: number;
  /** Cooling rate per iteration (default 0.985). */
  coolingRate?: number;
  /** Weight for RTP error (default 1.0). */
  wRtp?: number;
  /** Weight for hit-rate error (default 1.0). */
  wHit?: number;
  /** Weight for within-reel clustering (default 0.3). */
  wCluster?: number;
  /** Weight for cross-reel alignment (default 0.5). */
  wAlign?: number;
  /** Minimum average multiplier the optimizer tries to preserve (default 3.0). */
  minAvgMultiplier?: number;
}

export interface ReelOptimizerResult {
  strips: string[][];
  multipliers: Record<string, number>;
  finalRTP: number;
  finalHitRate: number;
  finalAvgMultiplier: number;
  log: string[];
}

/* ------------------------------------------------------------------ */
/*  Fast PRNG                                                          */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/*  Strip-based Monte Carlo simulator                                   */
/* ------------------------------------------------------------------ */

const STRING_TO_SYMBOL: Record<string, Symbol> = {
  TEN: Symbol.Ten,
  JACK: Symbol.Jack,
  QUEEN: Symbol.Queen,
  KING: Symbol.King,
  ACE: Symbol.Ace,
  WILD: Symbol.Wild,
};

function simulateStrips(
  strips: string[][],
  multipliers: Record<string, number>,
  spins: number,
  seed: number,
  paylineEngine: PaylineEngine,
  rows: number,
  cols: number
): { rtp: number; hitRate: number; avgMultiplier: number; maxMultiplier: number } {
  const payoutEngine = new PayoutEngine(paylineEngine, multipliers);
  const rand = mulberry32(seed);
  const lens = strips.map((s) => s.length);

  let totalWinnings = 0;
  let winningSpins = 0;
  let sumMult = 0;
  let maxMult = 0;

  for (let i = 0; i < spins; i++) {
    // Spin each reel to a random offset
    const grid: Symbol[][] = [];
    for (let c = 0; c < cols; c++) {
      const offset = Math.floor(rand() * lens[c]);
      for (let r = 0; r < rows; r++) {
        if (!grid[r]) grid[r] = [];
        const idx = (offset + r) % lens[c];
        grid[r][c] = STRING_TO_SYMBOL[strips[c][idx]];
      }
    }

    // Build wild-replacement grids (same logic as SpinEngine)
    const wildReplacements: Symbol[][][] = [];
    for (let sym = 0; sym < GRID_CONFIG.paylineSymbols; sym++) {
      const copy: Symbol[][] = [];
      for (let r = 0; r < rows; r++) {
        copy[r] = [];
        for (let c = 0; c < cols; c++) {
          copy[r][c] = grid[r][c] === Symbol.Wild ? (sym as Symbol) : grid[r][c];
        }
      }
      wildReplacements.push(copy);
    }

    const payout = payoutEngine.calculatePayout(grid, wildReplacements, 1.0);
    totalWinnings += payout.winnings;
    sumMult += payout.multiplier;
    if (payout.winnings > 0) {
      winningSpins++;
      if (payout.multiplier > maxMult) maxMult = payout.multiplier;
    }
  }

  return {
    rtp: (totalWinnings / spins) * 100,
    hitRate: winningSpins / spins,
    avgMultiplier: sumMult / spins,
    maxMultiplier: maxMult,
  };
}

/* ------------------------------------------------------------------ */
/*  Penalty functions                                                   */
/* ------------------------------------------------------------------ */

/** Count how many symbols of each type appear on a reel. */
function countSymbols(strip: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of strip) {
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

/**
 * Penalise adjacent identical symbols (runs).
 * A run of length L contributes (L-1)^2.
 */
function clusterPenalty(strip: string[]): number {
  let penalty = 0;
  let i = 0;
  while (i < strip.length) {
    let j = i + 1;
    while (j < strip.length && strip[j] === strip[i]) j++;
    const run = j - i;
    if (run >= 2) {
      penalty += (run - 1) * (run - 1);
    }
    i = j;
  }
  return penalty;
}

/**
 * Approximate cross-reel alignment probability.
 * For each payline symbol we compute the product of its per-reel
 * densities.  Minimising this makes 4-oak (and 3-oak) hits rarer.
 */
function alignmentPenalty(strips: string[][]): number {
  const paylineSyms = ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE'];
  let penalty = 0;
  for (const sym of paylineSyms) {
    let prod = 1;
    for (const strip of strips) {
      const p = strip.filter((s) => s === sym).length / strip.length;
      prod *= p;
    }
    penalty += prod;
  }
  return penalty;
}

/* ------------------------------------------------------------------ */
/*  Move operators                                                      */
/* ------------------------------------------------------------------ */

type MoveResult = {
  strips: string[][];
  multipliers: Record<string, number>;
  type: string;
};

function cloneStrips(strips: string[][]): string[][] {
  return strips.map((s) => [...s]);
}

function randomSwapWithinReel(strips: string[][], reel: number, rng: () => number): MoveResult {
  const strip = strips[reel];
  const a = Math.floor(rng() * strip.length);
  let b = Math.floor(rng() * strip.length);
  while (b === a) b = Math.floor(rng() * strip.length);
  const next = cloneStrips(strips);
  [next[reel][a], next[reel][b]] = [next[reel][b], next[reel][a]];
  return { strips: next, multipliers: {}, type: 'shuffle' };
}

/**
 * Move one occurrence of a payline symbol from reel A to reel B by
 * swapping it with a different symbol on reel B.
 */
function moveSymbolBetweenReels(strips: string[][], rng: () => number): MoveResult {
  const cols = strips.length;
  const reelA = Math.floor(rng() * cols);
  let reelB = Math.floor(rng() * cols);
  while (reelB === reelA) reelB = Math.floor(rng() * cols);

  const countsA = countSymbols(strips[reelA]);
  // Candidates: symbols with at least 2 occurrences (keep 1 as minimum)
  const candidates = Object.keys(countsA).filter((s) => countsA[s] > 2 && s !== 'WILD');
  if (candidates.length === 0) {
    return randomSwapWithinReel(strips, reelA, rng);
  }

  const sym = candidates[Math.floor(rng() * candidates.length)];

  // Pick a position of `sym` on reelA and a non-`sym` on reelB
  const posA = strips[reelA].findIndex((s) => s === sym);
  const posB = strips[reelB].findIndex((s) => s !== sym);
  if (posA === -1 || posB === -1) {
    return randomSwapWithinReel(strips, reelA, rng);
  }

  const next = cloneStrips(strips);
  const other = next[reelB][posB];
  next[reelA][posA] = other;
  next[reelB][posB] = sym;
  return { strips: next, multipliers: {}, type: 'transfer' };
}

/**
 * Aggressively redistribute a symbol: move up to `maxMoves` occurrences
 * from the reel with the most of that symbol to the reel with the least.
 * This creates uneven cross-reel densities, which drastically lowers
 * the probability of multi-reel matches.
 *
 * When all reels have identical counts (common at start), this forces
 * an imbalance by picking two *different* reels at random.
 */
function redistributeSymbol(strips: string[][], rng: () => number, maxMoves = 35): MoveResult {
  const cols = strips.length;
  const paylineSyms = ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE'];
  const sym = paylineSyms[Math.floor(rng() * paylineSyms.length)];

  // Count per reel
  const counts = strips.map((s) => s.filter((x) => x === sym).length);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);

  // All indices that have max / min (handles ties)
  const maxIndices = counts.map((c, i) => (c === maxCount ? i : -1)).filter((i) => i !== -1);
  const minIndices = counts.map((c, i) => (c === minCount ? i : -1)).filter((i) => i !== -1);

  // Pick max and min reels, ensuring they are different
  const maxIdx = maxIndices[Math.floor(rng() * maxIndices.length)];
  let minIdx = minIndices[Math.floor(rng() * minIndices.length)];

  // If all counts are identical, force imbalance: pick any two different reels
  if (maxIdx === minIdx) {
    if (cols < 2 || counts[maxIdx] <= 1) {
      return randomSwapWithinReel(strips, Math.floor(rng() * cols), rng);
    }
    // Pick a different reel for minIdx
    const otherReels = counts.map((_, i) => i).filter((i) => i !== maxIdx);
    minIdx = otherReels[Math.floor(rng() * otherReels.length)];
  }

  if (counts[maxIdx] <= 1) {
    return randomSwapWithinReel(strips, Math.floor(rng() * cols), rng);
  }

  const next = cloneStrips(strips);
  let moves = 0;
  for (let i = 0; i < next[maxIdx].length && moves < maxMoves; i++) {
    if (next[maxIdx][i] === sym) {
      // Find a non-sym on minIdx reel
      const posB = next[minIdx].findIndex((s) => s !== sym);
      if (posB === -1) break;
      const other = next[minIdx][posB];
      next[maxIdx][i] = other;
      next[minIdx][posB] = sym;
      moves++;
    }
  }
  return { strips: next, multipliers: {}, type: 'redistribute' };
}

/**
 * Find a run of identical symbols and break it by swapping the middle
 * element with a distant different symbol.
 */
function antiClusterSwap(strips: string[][], rng: () => number): MoveResult {
  const reel = Math.floor(rng() * strips.length);
  const strip = strips[reel];

  // Find first run
  let runStart = -1;
  for (let i = 0; i < strip.length - 1; i++) {
    if (strip[i] === strip[i + 1]) {
      runStart = i;
      break;
    }
  }

  if (runStart === -1) {
    // Already clean – do a random internal swap
    return randomSwapWithinReel(strips, reel, rng);
  }

  const sym = strip[runStart];
  // Pick a distant index with a different symbol
  let posB = -1;
  for (let attempts = 0; attempts < strip.length * 2; attempts++) {
    const idx = Math.floor(rng() * strip.length);
    if (strip[idx] !== sym && Math.abs(idx - runStart) > 3) {
      posB = idx;
      break;
    }
  }
  if (posB === -1) {
    return randomSwapWithinReel(strips, reel, rng);
  }

  const next = cloneStrips(strips);
  // Swap the *second* element of the run (breaks adjacency)
  next[reel][runStart + 1] = strip[posB];
  next[reel][posB] = sym;
  return { strips: next, multipliers: {}, type: 'antiCluster' };
}

/* ------------------------------------------------------------------ */
/*  Main optimizer                                                      */
/* ------------------------------------------------------------------ */

export class ReelOptimizer {
  static optimize(config: ReelOptimizerConfig): ReelOptimizerResult {
    const rows = config.rows ?? GRID_CONFIG.rows;
    const cols = config.cols ?? GRID_CONFIG.cols;
    const minMatch = config.minMatch ?? GRID_CONFIG.minMatch;
    const paylineSymbols = config.paylineSymbols ?? GRID_CONFIG.paylineSymbols;
    const stripSize = config.stripSize ?? GRID_CONFIG.stripSize;

    const targetRTP = config.targetRTP;
    const targetHitRate = config.targetHitRate;
    const baseMultipliers = { ...config.baseMultipliers };

    const spinsPerEval = config.spinsPerEval ?? 5_000;
    const maxIters = config.iterations ?? 200;
    const T0 = config.temperature ?? 2.0;
    const cooling = config.coolingRate ?? 0.985;
    const wRtp = config.wRtp ?? 1.0;
    const wHit = config.wHit ?? 1.0;
    const wCluster = config.wCluster ?? 0.3;
    const wAlign = config.wAlign ?? 0.5;
    const minAvgMult = config.minAvgMultiplier ?? 3.0;

    const log: string[] = [];
    const paylineEngine = new PaylineEngine(rows, cols, minMatch);

    const rng = mulberry32(12345);
    const evalRng = () => rng();

    /* ---------- build starting strips (all real symbols) ---------- */
    // Every stop is a real symbol. Uneven cross-reel distribution lowers hit-rate.
    const baseDistribution = [
      { symbol: 'TEN', count: 35 },
      { symbol: 'JACK', count: 15 },
      { symbol: 'QUEEN', count: 25 },
      { symbol: 'KING', count: 15 },
      { symbol: 'ACE', count: 8 },
      { symbol: 'WILD', count: 2 },
    ];

    let currentStrips: string[][] = [];
    for (let c = 0; c < cols; c++) {
      const pool: string[] = [];
      for (const item of baseDistribution) {
        for (let i = 0; i < item.count; i++) pool.push(item.symbol);
      }
      // Fisher-Yates shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(evalRng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      currentStrips.push(pool.slice(0, stripSize));
    }

    /* ---------- Phase 1: optimise strips (layout + distribution) --- */
    log.push(`=== Phase 1: Strip optimisation  targetRTP=${targetRTP}%  targetHitRate=${(targetHitRate * 100).toFixed(1)}% ===`);

    let currentMults = { ...baseMultipliers };
    let bestStrips = currentStrips.map((s) => [...s]);
    let bestStripLoss = Infinity;
    let bestStripSim = simulateStrips(currentStrips, currentMults, spinsPerEval, 42, paylineEngine, rows, cols);

    function stripLoss(sim: { rtp: number; hitRate: number; avgMultiplier: number }, strips: string[][]): number {
      const cluster = strips.reduce((sum, s) => sum + clusterPenalty(s), 0);
      const align = alignmentPenalty(strips);
      const multShortfall = Math.max(0, minAvgMult - sim.avgMultiplier);
      return (
        wRtp * Math.abs(sim.rtp - targetRTP) +
        wHit * Math.abs(sim.hitRate - targetHitRate) * 100 +
        wCluster * cluster +
        wAlign * align * 100 +
        0.5 * multShortfall
      );
    }

    let currentLoss = stripLoss(bestStripSim, currentStrips);

    for (let iter = 0; iter < maxIters; iter++) {
      const T = T0 * Math.pow(cooling, iter);

      const moveRoll = evalRng();
      let proposal: MoveResult;
      if (moveRoll < 0.25) {
        proposal = redistributeSymbol(currentStrips, evalRng);
      } else if (moveRoll < 0.55) {
        proposal = moveSymbolBetweenReels(currentStrips, evalRng);
      } else if (moveRoll < 0.90) {
        proposal = antiClusterSwap(currentStrips, evalRng);
      } else {
        proposal = {
          strips: currentStrips.map((s) => [...s]),
          multipliers: {},
          type: 'noop',
        };
      }

      const sim = simulateStrips(proposal.strips, currentMults, spinsPerEval, 100 + iter, paylineEngine, rows, cols);
      const propLoss = stripLoss(sim, proposal.strips);
      const delta = propLoss - currentLoss;

      if (delta < 0 || evalRng() < Math.exp(-delta / T)) {
        currentStrips = proposal.strips;
        currentLoss = propLoss;
        if (propLoss < bestStripLoss) {
          bestStripLoss = propLoss;
          bestStrips = currentStrips.map((s) => [...s]);
          bestStripSim = sim;
        }
      }

      if (iter % 20 === 0 || propLoss < bestStripLoss) {
        const clust = proposal.strips.reduce((sum, s) => sum + clusterPenalty(s), 0);
        log.push(
          `Phase1 Iter ${iter + 1}:  RTP=${sim.rtp.toFixed(2)}%  hitRate=${(sim.hitRate * 100).toFixed(2)}%  ` +
            `avgMult=${sim.avgMultiplier.toFixed(2)}  cluster=${clust.toFixed(1)}  ` +
            `align=${alignmentPenalty(proposal.strips).toFixed(4)}  loss=${propLoss.toFixed(2)}  T=${T.toFixed(3)}`
        );
      }
    }

    log.push(
      `Phase1 best:  RTP=${bestStripSim.rtp.toFixed(2)}%  hitRate=${(bestStripSim.hitRate * 100).toFixed(2)}%  ` +
        `avgMult=${bestStripSim.avgMultiplier.toFixed(2)}`
    );

    /* ---------- Phase 2: optimise multipliers to hit RTP target ----- */
    log.push(`=== Phase 2: Multiplier scaling  targetRTP=${targetRTP}% ===`);

    currentStrips = bestStrips.map((s) => [...s]);
    let bestMults = { ...currentMults };
    let bestMultLoss = Infinity;
    let bestMultSim = bestStripSim;
    currentLoss = wRtp * Math.abs(bestStripSim.rtp - targetRTP);

    // Precompute valid multiplier keys for this grid size
    const validKeys: string[] = [];
    const validSymbols = ['Ten', 'Jack', 'Queen', 'King', 'Ace'];
    for (const sym of validSymbols.slice(0, paylineSymbols)) {
      for (let size = minMatch; size <= cols; size++) {
        validKeys.push(`${size} ${sym}`);
      }
    }

    for (let iter = 0; iter < maxIters; iter++) {
      const T = T0 * Math.pow(cooling, iter);

      let nextMults: Record<string, number>;
      let moveType: string;

      if (evalRng() < 0.40) {
        // GLOBAL SCALE: scale all multipliers by a common factor
        const ratio = targetRTP / (bestMultSim.rtp || 1);
        const noise = 0.85 + 0.30 * evalRng(); // 0.85 – 1.15
        const scale = Math.max(0.1, Math.min(3.0, ratio * noise));
        nextMults = {};
        for (const k of validKeys) {
          nextMults[k] = (currentMults[k] ?? getMultiplier(parseInt(k.split(' ')[0], 10), k.split(' ')[1])) * scale;
        }
        moveType = 'global';
      } else {
        // LOCAL TWEAK: adjust one multiplier
        const key = validKeys[Math.floor(evalRng() * validKeys.length)];
        const currentVal = currentMults[key] ?? getMultiplier(parseInt(key.split(' ')[0], 10), key.split(' ')[1]);
        const factor = evalRng() < 0.5 ? 1.15 : 0.85;
        nextMults = { ...currentMults, [key]: currentVal * factor };
        moveType = 'local';
      }

      const sim = simulateStrips(currentStrips, nextMults, spinsPerEval, 200 + iter, paylineEngine, rows, cols);

      // Loss: RTP error + heavy penalty for dropping multipliers too low
      const multShortfall = Math.max(0, minAvgMult - sim.avgMultiplier);
      const propLoss = wRtp * Math.abs(sim.rtp - targetRTP) + 2.0 * multShortfall;
      const delta = propLoss - currentLoss;

      if (delta < 0 || evalRng() < Math.exp(-delta / T)) {
        currentMults = nextMults;
        currentLoss = propLoss;
        if (propLoss < bestMultLoss) {
          bestMultLoss = propLoss;
          bestMults = { ...currentMults };
          bestMultSim = sim;
        }
      }

      if (iter % 20 === 0 || propLoss < bestMultLoss) {
        log.push(
          `Phase2 Iter ${iter + 1}:  RTP=${sim.rtp.toFixed(2)}%  hitRate=${(sim.hitRate * 100).toFixed(2)}%  ` +
            `avgMult=${sim.avgMultiplier.toFixed(2)}  loss=${propLoss.toFixed(2)}  T=${T.toFixed(3)}  (${moveType})`
        );
      }
    }

    log.push(
      `Phase2 best:  RTP=${bestMultSim.rtp.toFixed(2)}%  hitRate=${(bestMultSim.hitRate * 100).toFixed(2)}%  ` +
        `avgMult=${bestMultSim.avgMultiplier.toFixed(2)}`
    );

    return {
      strips: bestStrips,
      multipliers: bestMults,
      finalRTP: bestMultSim.rtp,
      finalHitRate: bestMultSim.hitRate,
      finalAvgMultiplier: bestMultSim.avgMultiplier,
      log,
    };
  }
}
