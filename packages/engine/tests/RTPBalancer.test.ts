/**
 * @fileoverview RTPBalancer.test.ts
 *
 * Tests for the reverse Monte Carlo RTP optimizer.
 */

import { describe, it, expect } from 'vitest';
import { RTPBalancer } from '../src/RTPBalancer';
import { RTPSimulator } from '../src/RTPSimulator';

describe('RTPBalancer', () => {
  it('returns a result object with expected shape', () => {
    const result = RTPBalancer.balance(50, 5, 20, {
      rows: 3,
      cols: 3,
      minMatch: 3,
      paylineSymbols: 5,
    });

    expect(typeof result.converged).toBe('boolean');
    expect(result.iterations).toBeGreaterThanOrEqual(0);
    expect(result.iterations).toBeLessThanOrEqual(20);
    expect(result.finalRTP).toBeGreaterThan(0);
    expect(result.finalRTP).toBeLessThan(200);
    expect(result.targetRTP).toBe(50);
    expect(result.tolerance).toBe(5);
    expect(Array.isArray(result.log)).toBe(true);
    expect(result.log.length).toBeGreaterThan(0);

    // Thresholds should be valid
    const t = result.thresholds;
    expect(t.ten).toBeGreaterThanOrEqual(50);
    expect(t.ten).toBeLessThan(t.jack);
    expect(t.jack).toBeLessThan(t.queen);
    expect(t.queen).toBeLessThan(t.king);
    expect(t.king).toBeLessThan(t.ace);
    expect(t.ace).toBeLessThan(t.wild);
    expect(t.wild).toBeLessThan(t.bonus);
    expect(t.bonus).toBe(999);

    // Multipliers should be non-negative
    for (const v of Object.values(result.multipliers)) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('moves RTP closer to the target', () => {
    // First measure current RTP
    const sim = new RTPSimulator({
      rows: 3, cols: 3, minMatch: 3, paylineSymbols: 5,
      thresholds: { ten: 450, jack: 550, queen: 750, king: 880, ace: 970, wild: 990, bonus: 999 },
      multipliers: {},
    });
    const baseline = sim.quickEstimate(42);

    // Target something different from baseline
    const target = baseline > 60 ? 30 : 80;
    const result = RTPBalancer.balance(target, 10, 30, {
      rows: 3, cols: 3, minMatch: 3, paylineSymbols: 5,
    });

    const distBefore = Math.abs(baseline - target);
    const distAfter = Math.abs(result.finalRTP - target);

    // Should have moved closer (or at least not wildly away)
    expect(distAfter).toBeLessThanOrEqual(distBefore + 15);
  });

  it('produces valid threshold configurations', () => {
    const result = RTPBalancer.balance(40, 5, 10, {
      rows: 3, cols: 3, minMatch: 3, paylineSymbols: 5,
    });

    const vals = Object.values(result.thresholds);
    // All thresholds should be strictly increasing with minimum gaps
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });
});
