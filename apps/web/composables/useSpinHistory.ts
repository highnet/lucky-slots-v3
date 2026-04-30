import { useAuthStore } from '~/stores/auth';

const API_URL = 'http://localhost:4000/graphql';

async function graphqlRequest<T>(query: string, variables?: Record<string, any>): Promise<T> {
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

export interface SpinHistoryEntry {
  id: string;
  bet: number;
  winnings: number;
  multiplier: number;
  timestamp: string;
}

export function useSpinHistory() {
  const authStore = useAuthStore();

  async function fetchHistory(limit = 50): Promise<SpinHistoryEntry[]> {
    const data = await graphqlRequest<{ mySpins: any[] }>(`
      query {
        mySpins(limit: ${limit}) {
          id
          bet
          winnings
          multiplier
          timestamp
        }
      }
    `);
    return data.mySpins.map((s) => ({
      id: s.id,
      bet: s.bet,
      winnings: s.winnings,
      multiplier: s.multiplier,
      timestamp: s.timestamp,
    }));
  }

  return { fetchHistory };
}
