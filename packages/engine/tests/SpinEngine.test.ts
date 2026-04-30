import { describe, it, expect } from 'vitest';
import { SpinEngine, type RngFunction } from '../src/SpinEngine';
import { Symbol } from '../src/types';

describe('SpinEngine', () => {
  it('generates a 4x5 grid', () => {
    const engine = new SpinEngine();
    const result = engine.spin();
    expect(result.symbols).toHaveLength(4);
    for (const row of result.symbols) {
      expect(row).toHaveLength(5);
    }
  });

  it('produces correct symbol distribution with deterministic RNG', () => {
    // Deterministic RNG that cycles through all possible values
    let counter = 0;
    const rng: RngFunction = () => {
      const val = counter % 999;
      counter++;
      return val;
    };

    const engine = new SpinEngine(rng);
    const result = engine.spin();

    // With counter starting at 0, the first 20 values (0..19) are all < 450, so all Ten
    expect(result.symbols[0][0]).toBe(Symbol.Ten);
    expect(result.symbols[0][1]).toBe(Symbol.Ten);

    // After 450 Tens, next should be Jack (450..549)
    // We only have 20 cells, so everything is Ten in this spin
    expect(result.symbols.every((row) => row.every((s) => s === Symbol.Ten))).toBe(true);
  });

  it('replaces wilds correctly', () => {
    const engine = new SpinEngine(() => 990); // Always Bonus
    // Actually 990 gives Bonus. To get Wild, need 970..989
    const wildEngine = new SpinEngine(() => 980); // Always Wild
    const result = wildEngine.spin();
    expect(result.symbols.every((row) => row.every((s) => s === Symbol.Wild))).toBe(true);

    const replacements = wildEngine.replaceWilds(result.symbols);
    expect(replacements).toHaveLength(5);

    for (let i = 0; i < 5; i++) {
      const expectedSymbol = i as Symbol;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 5; col++) {
          expect(replacements[i][row][col]).toBe(expectedSymbol);
        }
      }
    }
  });

  it('preserves non-wild symbols in replacements', () => {
    const grid: Symbol[][] = [
      [Symbol.Ten, Symbol.Wild, Symbol.Ten, Symbol.Wild, Symbol.Ten],
      [Symbol.Jack, Symbol.Queen, Symbol.King, Symbol.Ace, Symbol.Bonus],
      [Symbol.Wild, Symbol.Ten, Symbol.Jack, Symbol.Queen, Symbol.King],
      [Symbol.Ace, Symbol.Bonus, Symbol.Wild, Symbol.Ten, Symbol.Jack],
    ];

    const engine = new SpinEngine(() => 0);
    const replacements = engine.replaceWilds(grid);

    // Replacement 0: Wild -> Ten
    expect(replacements[0][0][0]).toBe(Symbol.Ten);
    expect(replacements[0][0][1]).toBe(Symbol.Ten); // was Wild
    expect(replacements[0][0][2]).toBe(Symbol.Ten);
    expect(replacements[0][1][0]).toBe(Symbol.Jack); // unchanged

    // Replacement 4: Wild -> Ace
    expect(replacements[4][0][1]).toBe(Symbol.Ace); // was Wild
    expect(replacements[4][1][0]).toBe(Symbol.Jack); // unchanged
  });
});
