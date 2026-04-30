/**
 * @fileoverview composables/useGameState.ts
 *
 * Vue composable for game-play GraphQL operations.
 *
 * Handles `spin`, `cycleBet`, and `setBet` mutations. After each successful
 * call it updates both the game store (last spin, current bet) and the auth
 * store (balance) so the UI reflects server truth immediately.
 */

import { useGameStore } from '~/stores/game';
import { useAuthStore } from '~/stores/auth';
import type { SpinResult } from '~/stores/game';
import type { User } from '~/stores/auth';

/** GraphQL endpoint shared across all composables. */
const API_URL = 'http://localhost:4000/graphql';

/**
 * Generic GraphQL POST helper with credentials included.
 *
 * @throws Error when the GraphQL response contains errors
 */
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

/**
 * Provides reactive game helpers and syncs spin/bet state with the Pinia stores.
 */
export function useGameState() {
  const gameStore = useGameStore();
  const authStore = useAuthStore();

  /** Execute a spin mutation and update local stores with the result. */
  async function spin() {
    const data = await graphqlRequest<{ spin: SpinResult }>(`
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

  /** Rotate the current bet to the next predefined amount. */
  async function cycleBet() {
    const data = await graphqlRequest<{ cycleBet: User }>(`
      mutation {
        cycleBet { id username balance currentBet }
      }
    `);
    const result = data.cycleBet;
    gameStore.setBet(parseFloat(String(result.currentBet)));
    // Update auth store so header display reflects new bet
    if (authStore.user) {
      authStore.user.currentBet = parseFloat(String(result.currentBet));
      authStore.user.balance = parseFloat(String(result.balance));
    }
    return result;
  }

  /** Set the current bet to a specific amount. */
  async function setBet(amount: number) {
    const data = await graphqlRequest<{ setBet: User }>(`
      mutation SetBet($amount: Float!) {
        setBet(amount: $amount) { id username balance currentBet }
      }
    `, { amount });
    const result = data.setBet;
    gameStore.setBet(parseFloat(String(result.currentBet)));
    if (authStore.user) {
      authStore.user.currentBet = parseFloat(String(result.currentBet));
      authStore.user.balance = parseFloat(String(result.balance));
    }
    return result;
  }

  return { spin, cycleBet, setBet };
}
