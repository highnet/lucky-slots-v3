import { describe, it, expect, beforeEach } from 'vitest';
import { getPaylinePaths, clearPaylineCache } from '../src/PaylineEngine';
import { GRID_CONFIG } from '../src/config';

describe('PaylineEngine', () => {
  beforeEach(() => {
    clearPaylineCache();
  });

  it('has correct coordinate structure for current grid', () => {
    const paths = getPaylinePaths();
    expect(paths.length).toBeGreaterThan(0);

    for (const path of paths) {
      expect(path.coordinates.length).toBeGreaterThanOrEqual(GRID_CONFIG.minMatch);
      expect(path.coordinates.length).toBeLessThanOrEqual(GRID_CONFIG.cols);

      // Columns strictly increase by 1
      for (let i = 1; i < path.coordinates.length; i++) {
        expect(path.coordinates[i].col).toBe(path.coordinates[i - 1].col + 1);
      }

      // Rows are within bounds
      for (const coord of path.coordinates) {
        expect(coord.row).toBeGreaterThanOrEqual(0);
        expect(coord.row).toBeLessThan(GRID_CONFIG.rows);
        expect(coord.col).toBeGreaterThanOrEqual(0);
        expect(coord.col).toBeLessThan(GRID_CONFIG.cols);
      }
    }
  });

  it('has no duplicate paths', () => {
    const paths = getPaylinePaths();
    const seen = new Set<string>();
    for (const path of paths) {
      const key = path.coordinates.map((c) => `${c.row},${c.col}`).join('|');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('caches paths across instances', () => {
    const p1 = getPaylinePaths();
    const p2 = getPaylinePaths();
    expect(p1).toBe(p2); // same reference
  });

  it('supports different grid sizes', () => {
    const paths3x3 = getPaylinePaths(3, 3, 3);
    const paths4x5 = getPaylinePaths(4, 5, 3);

    expect(paths3x3.length).toBeGreaterThan(0);
    expect(paths4x5.length).toBeGreaterThan(0);

    // 4x5 should have more paths than 3x3
    expect(paths4x5.length).toBeGreaterThan(paths3x3.length);
  });
});
