import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGameStore } from '../../stores/game';

describe('game store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('has default state', () => {
    const store = useGameStore();
    expect(store.balance).toBe(1000);
    expect(store.bet).toBe(0.1);
    expect(store.phase).toBe('idle');
    expect(store.lastSpin).toBeNull();
    expect(store.winningPaths).toEqual([]);
    expect(store.isSpinning).toBe(false);
  });

  it('setBalance updates balance', () => {
    const store = useGameStore();
    store.setBalance(500);
    expect(store.balance).toBe(500);
  });

  it('setBet updates bet', () => {
    const store = useGameStore();
    store.setBet(1.0);
    expect(store.bet).toBe(1.0);
  });

  it('setPhase updates phase and isSpinning', () => {
    const store = useGameStore();
    store.setPhase('spinning');
    expect(store.phase).toBe('spinning');
    expect(store.isSpinning).toBe(true);

    store.setPhase('landing');
    expect(store.phase).toBe('landing');
    expect(store.isSpinning).toBe(true);

    store.setPhase('idle');
    expect(store.phase).toBe('idle');
    expect(store.isSpinning).toBe(false);
  });

  it('setLastSpin updates lastSpin, balance, and winningPaths', () => {
    const store = useGameStore();
    const result = {
      id: 'spin-1',
      symbols: [['TEN', 'JACK']],
      winningPaths: [{ symbol: 'TEN', size: 2, coordinates: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }],
      multiplier: 2,
      winnings: 10,
      bet: 0.1,
      newBalance: 150,
      timestamp: '2024-01-01T00:00:00Z',
    };
    store.setLastSpin(result);
    expect(store.lastSpin).toEqual(result);
    expect(store.balance).toBe(150);
    expect(store.winningPaths).toEqual(result.winningPaths);
  });

  it('setLastSpin with null only clears lastSpin', () => {
    const store = useGameStore();
    store.setLastSpin(null);
    expect(store.lastSpin).toBeNull();
    // balance and winningPaths should remain unchanged from defaults
    expect(store.balance).toBe(1000);
    expect(store.winningPaths).toEqual([]);
  });

  it('resetWinningPaths clears winningPaths', () => {
    const store = useGameStore();
    store.setLastSpin({
      id: 'spin-1',
      symbols: [['TEN']],
      winningPaths: [{ symbol: 'TEN', size: 1, coordinates: [{ row: 0, col: 0 }] }],
      multiplier: 1,
      winnings: 1,
      bet: 0.1,
      newBalance: 100,
      timestamp: '2024-01-01T00:00:00Z',
    });
    store.resetWinningPaths();
    expect(store.winningPaths).toEqual([]);
  });
});
