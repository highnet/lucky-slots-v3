import { useGameStore } from '~/stores/game';
import { useAuthStore } from '~/stores/auth';

const API_URL = 'http://localhost:4000/graphql';

async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }
  return json.data as T;
}

export function useGameState() {
  const gameStore = useGameStore();
  const authStore = useAuthStore();

  async function spin() {
    const data = await graphqlRequest<{ spin: unknown }>(`
      mutation {
        spin {
          id
          symbols
          winningPaths { symbol size coordinates { row col } }
          multiplier
          winnings
          bet
          newBalance
          timestamp
        }
      }
    `);
    const result = data.spin;
    gameStore.setLastSpin(result);
    // Update auth store balance so header display reflects server truth
    if (authStore.user && result.newBalance !== undefined) {
      authStore.user.balance = result.newBalance;
    }
    return result;
  }

  async function cycleBet() {
    const data = await graphqlRequest<{ cycleBet: unknown }>(`
      mutation {
        cycleBet { id username balance currentBet }
      }
    `);
    const result = data.cycleBet;
    gameStore.setBet(parseFloat(result.currentBet));
    // Update auth store so header display reflects new bet
    if (authStore.user) {
      authStore.user.currentBet = parseFloat(result.currentBet);
      authStore.user.balance = parseFloat(result.balance);
    }
    return result;
  }

  async function setBet(amount: number) {
    const data = await graphqlRequest<{ setBet: unknown }>(`
      mutation SetBet($amount: Float!) {
        setBet(amount: $amount) { id username balance currentBet }
      }
    `, { amount });
    const result = data.setBet;
    gameStore.setBet(parseFloat(result.currentBet));
    if (authStore.user) {
      authStore.user.currentBet = parseFloat(result.currentBet);
      authStore.user.balance = parseFloat(result.balance);
    }
    return result;
  }

  return { spin, cycleBet, setBet };
}
