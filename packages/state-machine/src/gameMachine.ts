/**
 * @fileoverview gameMachine.ts
 *
 * XState finite-state machine that models the Lucky Slots UI flow.
 *
 * States:
 *   idle            – waiting for player input
 *   spinning        – reels are animating (3s timeout fallback)
 *   landing         – reels have stopped, deciding next step
 *   showingPaylines – highlighting winning lines
 *   showingWinners  – celebrating winning symbols
 *   showingWinnings – displaying the win amount
 *   resetting       – clearing the board back to idle
 *
 * Guards:
 *   canAffordBet – ensures balance >= current bet
 *   hasWinnings  – transitions to payline display only when there are wins
 *
 * Actions:
 *   deductBalance – subtracts bet from balance on spin start
 *   awardWinnings – adds spin winnings to balance
 *   resetBoard    – clears spin result and winning paths
 */

import { createMachine } from 'xstate';

/** Minimal spin result shape used by the machine context. */
interface SpinResult {
  winnings: number;
}

/** Minimal winning path shape used by the machine context. */
interface WinningPath {
  length: number;
}

/** XState machine driving the slot UI animation and phase transitions. */
export const gameMachine = createMachine(
  {
    id: 'game',
    initial: 'idle',
    context: {
      balance: 1000,
      bet: 0.1,
      spinResult: null as SpinResult | null,
      winningPaths: [] as WinningPath[],
    },
    states: {
      idle: {
        on: {
          SPIN: {
            target: 'spinning',
            guard: 'canAffordBet',
          },
        },
      },
      spinning: {
        entry: 'deductBalance',
        on: {
          SPIN_COMPLETE: {
            target: 'landing',
          },
        },
        after: {
          3000: { target: 'landing' },
        },
      },
      landing: {
        after: {
          1000: [
            { target: 'showingPaylines', guard: 'hasWinnings' },
            { target: 'idle' },
          ],
        },
      },
      showingPaylines: {
        after: {
          1500: { target: 'showingWinners' },
        },
      },
      showingWinners: {
        after: {
          1500: { target: 'showingWinnings' },
        },
      },
      showingWinnings: {
        entry: 'awardWinnings',
        after: {
          3000: { target: 'resetting' },
        },
      },
      resetting: {
        entry: 'resetBoard',
        always: { target: 'idle' },
      },
    },
  },
  {
    guards: {
      canAffordBet: ({ context }) => context.balance >= context.bet,
      hasWinnings: ({ context }) => context.winningPaths.length > 0,
    },
    actions: {
      deductBalance: ({ context }) => {
        context.balance -= context.bet;
      },
      awardWinnings: ({ context }) => {
        if (context.spinResult) {
          context.balance += context.spinResult.winnings;
        }
      },
      resetBoard: ({ context }) => {
        context.winningPaths = [];
        context.spinResult = null;
      },
    },
  }
);
