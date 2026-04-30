/**
 * @fileoverview RTPSimulator.ts
 *
 * Monte Carlo simulator for analyzing slot machine Return-to-Player (RTP).
 *
 * Given a grid configuration, symbol thresholds, and payout multipliers,
 * this class runs millions of simulated spins and reports:
 *   - Overall RTP percentage
 *   - Hit frequency
 *   - Per-symbol RTP contribution
 *   - Average multiplier per spin
 *   - Variance / volatility estimate
 *
 * All simulations use a fast non-cryptographic RNG (Mulberry32) so
 * large batch sizes (1M–10M spins) complete in seconds.
 */

import { SpinEngine } from './SpinEngine';
import { PayoutEngine } from './PayoutEngine';
import { PaylineEngine } from './PaylineEngine';
import { GRID_CONFIG } from './config';
import { getMultiplier } from './constants';
import { Symbol } from './types';

/** Fast 32-bit PRNG (Mulberry32). Seeded for reproducible simulations. */
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fastRng(seed: number): () => number {
  const rand = mulberry32(seed);
  return () => Math.floor(rand() * 999);
}

export interface RTPResult {
  /** Overall RTP: totalWinnings / totalBets * 100 */
  rtp: number;
  /** Fraction of spins that produced any win (0–1) */
  hitFrequency: number;
  /** Average multiplier awarded per spin */
  avgMultiplier: number;
  /** Maximum single-spin multiplier observed */
  maxMultiplier: number;
  /** Sample variance of multipliers */
  variance: number;
  /** Total number of simulated spins */
  spins: number;
  /** Per-symbol contribution to total RTP */
  perSymbolRTP: Record<string, number>;
  /** 95% confidence interval half-width for RTP */
  confidenceInterval: number;
}

export interface RTPInputConfig {
  rows: number;
  cols: number;
  minMatch: number;
  paylineSymbols: number;
  thresholds: Record<string, number>;
  multipliers: Record<string, number>;
}

export class RTPSimulator {
  private paylineEngine: PaylineEngine;
  private payoutEngine: PayoutEngine;

  constructor(
    private config: RTPInputConfig = {
      rows: GRID_CONFIG.rows,
      cols: GRID_CONFIG.cols,
      minMatch: GRID_CONFIG.minMatch,
      paylineSymbols: GRID_CONFIG.paylineSymbols,
      thresholds: { ten: 450, jack: 550, queen: 750, king: 880, ace: 970, wild: 990, bonus: 999 },
      multipliers: {},
    }
  ) {
    this.paylineEngine = new PaylineEngine(config.rows, config.cols, config.minMatch);
    this.payoutEngine = new PayoutEngine(this.paylineEngine, config.multipliers);
  }

  /**
   * Run a Monte Carlo simulation.
   *
   * @param spins   Number of spins to simulate (default 100_000)
   * @param bet     Bet amount per spin (default 1.0)
   * @param seed    PRNG seed for reproducibility (default 42)
   * @returns       Complete RTP analysis
   */
  run(spins = 100_000, bet = 1.0, seed = 42): RTPResult {
    const spinEngine = new SpinEngine(fastRng(seed), this.config.thresholds);

    let totalWinnings = 0;
    let totalBets = 0;
    let winningSpins = 0;
    let maxMultiplier = 0;
    let sumMultipliers = 0;
    let sumSqMultipliers = 0;

    const perSymbolWinnings: Record<string, number> = {};

    for (let i = 0; i < spins; i++) {
      const spinResult = spinEngine.spin();
      const payout = this.payoutEngine.calculatePayout(
        spinResult.symbols,
        spinResult.wildReplacements,
        bet
      );

      totalBets += bet;
      totalWinnings += payout.winnings;
      sumMultipliers += payout.multiplier;
      sumSqMultipliers += payout.multiplier * payout.multiplier;

      if (payout.winnings > 0) {
        winningSpins++;
        maxMultiplier = Math.max(maxMultiplier, payout.multiplier);
      }

      // Track per-symbol contribution
      for (const wp of payout.winningPaths) {
        const symName = Symbol[wp.symbol];
        const key = `${wp.size} ${symName}`;
        const mult = this.config.multipliers[key] ?? getMultiplier(wp.size, symName);
        perSymbolWinnings[symName] = (perSymbolWinnings[symName] || 0) + mult * bet;
      }
    }

    const rtp = (totalWinnings / totalBets) * 100;
    const hitFrequency = winningSpins / spins;
    const avgMultiplier = sumMultipliers / spins;
    const meanSq = sumSqMultipliers / spins;
    const variance = meanSq - avgMultiplier * avgMultiplier;

    // 95% CI using normal approximation
    const stdErr = Math.sqrt(variance / spins);
    const confidenceInterval = 1.96 * stdErr * 100; // in percentage points

    const perSymbolRTP: Record<string, number> = {};
    for (const [sym, winnings] of Object.entries(perSymbolWinnings)) {
      perSymbolRTP[sym] = (winnings / totalBets) * 100;
    }

    return {
      rtp,
      hitFrequency,
      avgMultiplier,
      maxMultiplier,
      variance,
      spins,
      perSymbolRTP,
      confidenceInterval,
    };
  }

  /**
   * Quick 10K-spin estimate for use inside iterative optimizers.
   */
  quickEstimate(seed = 42): number {
    return this.run(10_000, 1.0, seed).rtp;
  }
}
