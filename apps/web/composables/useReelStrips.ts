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

let cachedStrips: string[][] | null = null;

export async function fetchReelStrips(): Promise<string[][]> {
  if (cachedStrips) return cachedStrips;
  const data = await graphqlRequest<{ reelStrips: string[][] }>(`
    query { reelStrips }
  `);
  cachedStrips = data.reelStrips;
  return cachedStrips;
}

// Get the next window of 4 symbols starting from an offset (wraps around)
export function getReelWindow(reelIndex: number, offset: number, strips: string[][]): string[] {
  const strip = strips[reelIndex];
  if (!strip) return ['TEN', 'TEN', 'TEN', 'TEN'];
  const result: string[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = (offset + i) % strip.length;
    result.push(strip[idx]);
  }
  return result;
}
