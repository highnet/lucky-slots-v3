/**
 * @fileoverview RTPSimulator.test.ts
 *
 * Tests for the Monte Carlo RTP simulator.
 */

import { describe, it, expect } from 'vitest';
import { RTPSimulator } from '../src/RTPSimulator';

describe('RTPSimulator', () => {
  it('runs a basic simulation and returns valid metrics', () => {
    const sim = new RTPSimulator({
      rows: 3,
      cols: 3,
      minMatch: 3,
      paylineSymbols: 5,
      thresholds: { ten: 450, jack: 550, queen: 750, king: 880, ace: 970, wild: 990, bonus: 999 },
      multipliers: {
        '3 Ten': 0.25, '4 Ten': 1, '5 Ten': 5,
        '3 Jack': 0.5, '4 Jack': 2, '5 Jack': 10,
        '3 Queen': 1, '4 Queen': 4, '5 Queen': 20,
        '3 King': 2, '4 King': 8, '5 King': 40,
        '3 Ace': 4, '4 Ace': 12, '5 Ace': 56,
      },
    });

    const result = sim.run(10_000, 1.0, 42);

    expect(result.rtp).toBeGreaterThan(0);
    expect(result.rtp).toBeLessThan(200); // Sanity cap
    expect(result.hitFrequency).toBeGreaterThanOrEqual(0);
    expect(result.hitFrequency).toBeLessThanOrEqual(1);
    expect(result.avgMultiplier).toBeGreaterThanOrEqual(0);
    expect(result.maxMultiplier).toBeGreaterThanOrEqual(0);
    expect(result.variance).toBeGreaterThanOrEqual(0);
    expect(result.spins).toBe(10_000);
    expect(result.confidenceInterval).toBeGreaterThan(0);
  });

  it('quickEstimate returns a number in reasonable range', () => {
    const sim = new RTPSimulator({
      rows: 3,
      cols: 3,
      minMatch: 3,
      paylineSymbols: 5,
      thresholds: { ten: 450, jack: 550, queen: 750, king: 880, ace: 970, wild: 990, bonus: 999 },
      multipliers: {},
    });

    const rtp = sim.quickEstimate(42);
    expect(rtp).toBeGreaterThan(0);
    expect(rtp).toBeLessThan(200);
  });

  it('returns consistent results for the same seed', () => {
    const sim = new RTPSimulator({
      rows: 3,
      cols: 3,
      minMatch: 3,
      paylineSymbols: 5,
      thresholds: { ten: 450, jack: 550, queen: 750, king: 880, ace: 970, wild: 990, bonus: 999 },
      multipliers: {},
    });

    const a = sim.run(5_000, 1.0, 123);
    const b = sim.run(5_000, 1.0, 123);
    expect(a.rtp).toBe(b.rtp);
    expect(a.hitFrequency).toBe(b.hitFrequency);
  });

  it('returns different results for different seeds', () => {
    const sim = new RTPSimulator({
      rows: 3,
      cols: 3,
      minMatch: 3,
      paylineSymbols: 5,
      thresholds: { ten: 450, jack: 550, queen: 750, king: 880, ace: 970, wild: 990, bonus: 999 },
      multipliers: {},
    });

    const a = sim.run(5_000, 1.0, 1);
    const b = sim.run(5_000, 1.0, 2);
    // Very unlikely to be exactly identical with different seeds
    expect(a.rtp).not.toBe(b.rtp);
  });
});
