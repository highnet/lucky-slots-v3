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
  newBalance?: number;
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
          newBalance
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
    return data.mySpins.map((s: unknown) => {
      const entry = s as Record<string, unknown>;
      return {
        id: String(entry.id ?? ''),
        bet: Number(entry.bet ?? 0),
        winnings: Number(entry.winnings ?? 0),
        multiplier: Number(entry.multiplier ?? 0),
        timestamp: String(entry.timestamp ?? ''),
        newBalance: entry.newBalance !== undefined ? Number(entry.newBalance) : undefined,
        symbols: Array.isArray(entry.symbols) ? (entry.symbols as string[][]) : [],
        winningPaths: Array.isArray(entry.winningPaths) ? (entry.winningPaths as SpinHistoryEntry['winningPaths']) : [],
      };
    });
  }

  return { fetchHistory };
}
