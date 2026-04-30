import { createMachine } from 'xstate';

interface SpinResult {
  winnings: number;
}

interface WinningPath {
  length: number;
}

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
