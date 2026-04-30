import { describe, it, expect } from 'vitest';
import { getReelWindow } from '../composables/useReelStrips';

describe('getReelWindow', () => {
  const strips: string[][] = [
    ['A', 'B', 'C', 'D', 'E'],
    ['F', 'G', 'H', 'I', 'J'],
  ];

  it('returns the correct window from the start of a strip', () => {
    const window = getReelWindow(0, 0, strips, 3);
    expect(window).toEqual(['A', 'B', 'C']);
  });

  it('returns the correct window with an offset', () => {
    const window = getReelWindow(0, 2, strips, 3);
    expect(window).toEqual(['C', 'D', 'E']);
  });

  it('wraps around when the window exceeds strip length', () => {
    const window = getReelWindow(0, 3, strips, 3);
    expect(window).toEqual(['D', 'E', 'A']);
  });

  it('handles a full wrap-around', () => {
    const window = getReelWindow(0, 4, strips, 3);
    expect(window).toEqual(['E', 'A', 'B']);
  });

  it('works with a different reel index', () => {
    const window = getReelWindow(1, 0, strips, 3);
    expect(window).toEqual(['F', 'G', 'H']);
  });

  it('uses default rowCount when not provided', () => {
    const longStrip = ['X', 'Y', 'Z', 'W', 'V', 'U', 'T', 'S'];
    const window = getReelWindow(0, 0, [longStrip]);
    // Default rowCount is GRID_CONFIG.rows which is 6
    expect(window).toHaveLength(6);
    expect(window).toEqual(['X', 'Y', 'Z', 'W', 'V', 'U']);
  });

  it('returns TEN fallback when strip is missing', () => {
    const window = getReelWindow(5, 0, strips, 4);
    expect(window).toEqual(['TEN', 'TEN', 'TEN', 'TEN']);
  });

  it('handles a window equal to strip length', () => {
    const window = getReelWindow(0, 0, strips, 5);
    expect(window).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('wraps correctly for multiple full cycles', () => {
    const window = getReelWindow(0, 7, strips, 3);
    // 7 % 5 = 2, so start at index 2
    expect(window).toEqual(['C', 'D', 'E']);
  });
});
