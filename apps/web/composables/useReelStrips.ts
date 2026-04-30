import { GRID_CONFIG } from '@lucky-slots/engine';

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

export interface GridConfig {
  rows: number;
  cols: number;
  minMatch: number;
  numSymbols: number;
  stripSize: number;
  paylineSymbols: number;
}

let cachedConfig: GridConfig | null = null;
let cachedStrips: string[][] | null = null;

export async function fetchGridConfig(): Promise<GridConfig> {
  if (cachedConfig) return cachedConfig;
  const data = await graphqlRequest<{ gridConfig: GridConfig }>(`
    query { gridConfig { rows cols minMatch numSymbols stripSize paylineSymbols } }
  `);
  cachedConfig = data.gridConfig;
  return cachedConfig;
}

export async function fetchReelStrips(): Promise<string[][]> {
  if (cachedStrips) return cachedStrips;
  const data = await graphqlRequest<{ reelStrips: string[][] }>(`
    query { reelStrips }
  `);
  cachedStrips = data.reelStrips;
  return cachedStrips;
}

export function getReelWindow(
  reelIndex: number,
  offset: number,
  strips: string[][],
  rowCount = GRID_CONFIG.rows
): string[] {
  const strip = strips[reelIndex];
  if (!strip) {
    return Array.from({ length: rowCount }, () => 'TEN');
  }
  const result: string[] = [];
  for (let i = 0; i < rowCount; i++) {
    const idx = (offset + i) % strip.length;
    result.push(strip[idx]);
  }
  return result;
}
