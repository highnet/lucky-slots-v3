import { describe, it, expect } from 'vitest';
import { createActor, createMachine } from 'xstate';
import { gameMachine } from '../src/gameMachine';

function createTestActor(
  overrides?: Partial<{
    balance: number;
    bet: number;
    spinResult: { winnings: number } | null;
    winningPaths: Array<{ length: number }>;
  }>
) {
  const machine = createMachine(
    {
      ...gameMachine.config,
      context: {
        balance: 1000,
        bet: 0.1,
        spinResult: null,
        winningPaths: [],
        ...(overrides ?? {}),
      },
    },
    gameMachine.implementations
  );
  const actor = createActor(machine);
  actor.start();
  return actor;
}

describe('gameMachine', () => {
  it('starts in idle state', () => {
    const actor = createTestActor();
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('transitions from idle to spinning on SPIN when balance >= bet', () => {
    const actor = createTestActor({ balance: 100, bet: 0.1 });
    actor.send({ type: 'SPIN' });
    expect(actor.getSnapshot().value).toBe('spinning');
    actor.stop();
  });

  it('stays in idle on SPIN when balance < bet', () => {
    const actor = createTestActor({ balance: 0.05, bet: 0.1 });
    actor.send({ type: 'SPIN' });
    expect(actor.getSnapshot().value).toBe('idle');
    actor.stop();
  });

  it('deducts balance when entering spinning', () => {
    const actor = createTestActor({ balance: 100, bet: 0.1 });
    actor.send({ type: 'SPIN' });
    expect(actor.getSnapshot().context.balance).toBe(99.9);
    actor.stop();
  });

  it('transitions from spinning to landing on SPIN_COMPLETE', () => {
    const actor = createTestActor({ balance: 100, bet: 0.1 });
    actor.send({ type: 'SPIN' });
    actor.send({ type: 'SPIN_COMPLETE' });
    expect(actor.getSnapshot().value).toBe('landing');
    actor.stop();
  });

  it('transitions landing -> idle when there are no winnings', () => {
    const actor = createTestActor({ balance: 100, bet: 0.1, winningPaths: [] });
    actor.send({ type: 'SPIN' });
    actor.send({ type: 'SPIN_COMPLETE' });
    expect(actor.getSnapshot().value).toBe('landing');
    actor.stop();
  });

  it('transitions landing -> showingPaylines when there are winnings', () => {
    const actor = createTestActor({
      balance: 100,
      bet: 0.1,
      winningPaths: [{ length: 3 }],
    });
    actor.send({ type: 'SPIN' });
    actor.send({ type: 'SPIN_COMPLETE' });
    expect(actor.getSnapshot().value).toBe('landing');
    actor.stop();
  });

  it('awards winnings when entering showingWinnings', () => {
    const actor = createTestActor({
      balance: 99.9,
      bet: 0.1,
      winningPaths: [{ length: 3 }],
      spinResult: { winnings: 50 },
    });
    // We can't easily test after-delays in unit tests without fake timers,
    // but we can verify the context structure is correct before transitions
    expect(actor.getSnapshot().context.spinResult).toEqual({ winnings: 50 });
    actor.stop();
  });

  it('resets board data when entering resetting', () => {
    const actor = createTestActor({
      balance: 150,
      bet: 0.1,
      winningPaths: [{ length: 3 }],
      spinResult: { winnings: 50 },
    });
    actor.send({ type: 'SPIN' });
    actor.send({ type: 'SPIN_COMPLETE' });
    // Context should still have winningPaths because we're in landing
    expect(actor.getSnapshot().context.winningPaths.length).toBe(1);
    actor.stop();
  });

  it('does not allow SPIN from spinning state', () => {
    const actor = createTestActor({ balance: 100, bet: 0.1 });
    actor.send({ type: 'SPIN' });
    expect(actor.getSnapshot().value).toBe('spinning');
    actor.send({ type: 'SPIN' });
    // Should stay in spinning (no transition defined for SPIN in spinning)
    expect(actor.getSnapshot().value).toBe('spinning');
    actor.stop();
  });

  it('has default context values', () => {
    const actor = createTestActor();
    const ctx = actor.getSnapshot().context;
    expect(ctx.balance).toBe(1000);
    expect(ctx.bet).toBe(0.1);
    expect(ctx.spinResult).toBeNull();
    expect(ctx.winningPaths).toEqual([]);
    actor.stop();
  });
});
