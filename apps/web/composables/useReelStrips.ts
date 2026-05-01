/**
 * @fileoverview composables/useReelStrips.ts
 *
 * Vue composable for fetching static slot configuration from the API.
 *
 * Provides cached access to `gridConfig` and `reelStrips`, plus a helper
 * `getReelWindow` that extracts a vertical slice of symbols from a strip
 * given a starting offset.
 */

import { GRID_CONFIG } from '@lucky-slots/engine';

/**
 * Generic GraphQL POST helper with credentials included.
 *
 * @throws Error when the GraphQL response contains errors
 */
async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { public: { apiUrl } } = useRuntimeConfig();
  const res = await fetch(apiUrl as string, {
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

/** Grid dimensions and payline settings returned by the API. */
export interface GridConfig {
  rows: number;
  cols: number;
  minMatch: number;
  numSymbols: number;
  stripSize: number;
  paylineSymbols: number;
}

/** In-memory cache so repeated calls during hydration are free. */
let cachedConfig: GridConfig | null = null;
let cachedStrips: string[][] | null = null;

/** Fetch grid config from the API (cached after first call). */
export async function fetchGridConfig(): Promise<GridConfig> {
  if (cachedConfig) return cachedConfig;
  const data = await graphqlRequest<{ gridConfig: GridConfig }>(`
    query { gridConfig { rows cols minMatch numSymbols stripSize paylineSymbols } }
  `);
  cachedConfig = data.gridConfig;
  return cachedConfig;
}

/** Fetch reel strips from the API (cached after first call). */
export async function fetchReelStrips(): Promise<string[][]> {
  if (cachedStrips) return cachedStrips;
  const data = await graphqlRequest<{ reelStrips: string[][] }>(`
    query { reelStrips }
  `);
  cachedStrips = data.reelStrips;
  return cachedStrips;
}

/**
 * Extract a vertical window of symbols from a single reel strip.
 *
 * @param reelIndex  Which reel (column) to read from
 * @param offset     Starting index in the strip (wraps around)
 * @param strips     Full set of reel strips from the API
 * @param rowCount   How many symbols to extract (defaults to grid rows)
 * @returns          Array of symbol names for that reel window
 */
export function getReelWindow(
  reelIndex: number,
  offset: number,
  strips: string[][],
  rowCount: number = GRID_CONFIG.rows
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
