import { describe, it, expect } from 'vitest';
import { getPaylinePaths, PaylineEngine } from '../src/PaylineEngine';
import { SLOTS_MAPPING } from '../src/PaylineEngine';

describe('PaylineEngine', () => {
  it('has 20 slot mappings', () => {
    expect(Object.keys(SLOTS_MAPPING)).toHaveLength(20);
  });

  it('generates paths with correct coordinate structure', () => {
    const paths = getPaylinePaths();
    expect(paths.length).toBeGreaterThan(0);

    for (const path of paths) {
      expect(path.coordinates.length).toBeGreaterThanOrEqual(3);
      expect(path.coordinates.length).toBeLessThanOrEqual(5);

      // Verify columns strictly increase by 1
      for (let i = 1; i < path.coordinates.length; i++) {
        expect(path.coordinates[i].col).toBe(path.coordinates[i - 1].col + 1);
      }
    }
  });

  it('has no duplicate paths', () => {
    const paths = getPaylineEngine().getPaths();
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
});

function getPaylineEngine() {
  return new PaylineEngine();
}
