import { describe, it, expect } from 'vitest';
import { SpinEngine, type RngFunction } from '../src/SpinEngine';
import { Symbol, NUM_ROWS, NUM_REELS } from '../src/types';

const TEST_STRIPS = [
  ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE', 'WILD'],
  ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE', 'WILD'],
  ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE', 'WILD'],
  ['TEN', 'JACK', 'QUEEN', 'KING', 'ACE', 'WILD'],
];

const WILD_STRIPS = [
  ['WILD'],
  ['WILD'],
  ['WILD'],
  ['WILD'],
];

describe('SpinEngine', () => {
  it('generates an N×M grid', () => {
    const engine = new SpinEngine(undefined, TEST_STRIPS);
    const result = engine.spin();
    expect(result.symbols).toHaveLength(NUM_ROWS);
    for (const row of result.symbols) {
      expect(row).toHaveLength(NUM_REELS);
    }
  });

  it('produces correct symbol distribution with deterministic RNG', () => {
    let counter = 0;
    const rng: RngFunction = () => counter++;

    const engine = new SpinEngine(rng, TEST_STRIPS);
    const result = engine.spin();

    expect(result.symbols[0][0]).toBe(Symbol.Ten);   // reel 0 offset 0
    expect(result.symbols[0][1]).toBe(Symbol.Jack);  // reel 1 offset 1
  });

  it('replaces wilds correctly', () => {
    const wildEngine = new SpinEngine(() => 0, WILD_STRIPS);
    const result = wildEngine.spin();
    expect(result.symbols.every((row) => row.every((s) => s === Symbol.Wild))).toBe(true);

    const replacements = wildEngine.replaceWilds(result.symbols);
    expect(replacements.length).toBeGreaterThan(0);

    for (let i = 0; i < replacements.length; i++) {
      const expectedSymbol = i as Symbol;
      for (let row = 0; row < NUM_ROWS; row++) {
        for (let col = 0; col < NUM_REELS; col++) {
          expect(replacements[i][row][col]).toBe(expectedSymbol);
        }
      }
    }
  });

  it('preserves non-wild symbols in replacements', () => {
    const grid: Symbol[][] = Array.from({ length: NUM_ROWS }, (_, r) =>
      Array.from({ length: NUM_REELS }, (_, c) => {
        if (c === 1) return Symbol.Wild;
        return (r + c) % 6 as Symbol;
      })
    );

    const engine = new SpinEngine(() => 0, TEST_STRIPS);
    const replacements = engine.replaceWilds(grid);

    expect(replacements[0][0][0]).toBe(grid[0][0]);
    expect(replacements[0][0][1]).toBe(Symbol.Ten); // Wild -> Ten
    expect(replacements[4][0][1]).toBe(Symbol.Ace); // Wild -> Ace
  });
});
