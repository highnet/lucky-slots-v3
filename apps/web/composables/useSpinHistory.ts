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

export interface SpinHistoryEntry {
  id: string;
  bet: number;
  winnings: number;
  multiplier: number;
  timestamp: string;
  symbols: string[][];
  winningPaths: {
    symbol: string;
    size: number;
    coordinates: { row: number; col: number }[];
  }[];
}

export function useSpinHistory() {
  async function fetchHistory(limit = 50): Promise<SpinHistoryEntry[]> {
    const data = await graphqlRequest<{ mySpins: unknown[] }>(`
      query {
        mySpins(limit: ${limit}) {
          id
          bet
          winnings
          multiplier
          timestamp
          symbols
          winningPaths {
            symbol
            size
            coordinates {
              row
              col
            }
          }
        }
      }
    `);
    return data.mySpins.map((s: any) => ({
      id: s.id,
      bet: s.bet,
      winnings: s.winnings,
      multiplier: s.multiplier,
      timestamp: s.timestamp,
      symbols: Array.isArray(s.symbols) ? s.symbols : [],
      winningPaths: Array.isArray(s.winningPaths) ? s.winningPaths : [],
    }));
  }

  return { fetchHistory };
}
