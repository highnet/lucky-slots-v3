import type { Coordinate, PaylinePath } from './types';

// Vertex to grid coordinate mapping
export const SLOTS_MAPPING: Record<number, Coordinate> = {
  0: { row: 0, col: 0 },
  1: { row: 0, col: 1 },
  2: { row: 0, col: 2 },
  3: { row: 0, col: 3 },
  4: { row: 0, col: 4 },
  5: { row: 1, col: 0 },
  6: { row: 1, col: 1 },
  7: { row: 1, col: 2 },
  8: { row: 1, col: 3 },
  9: { row: 1, col: 4 },
  10: { row: 2, col: 0 },
  11: { row: 2, col: 1 },
  12: { row: 2, col: 2 },
  13: { row: 2, col: 3 },
  14: { row: 2, col: 4 },
  15: { row: 3, col: 0 },
  16: { row: 3, col: 1 },
  17: { row: 3, col: 2 },
  18: { row: 3, col: 3 },
  19: { row: 3, col: 4 },
};

// Adjacency list representing possible slot payline transitions
const ADJACENCY_LIST: Record<number, number[]> = {
  0: [1, 6],
  1: [2, 7],
  2: [3, 8],
  3: [4, 9],
  4: [],
  5: [1, 6, 11],
  6: [2, 7, 12],
  7: [3, 8, 13],
  8: [4, 9, 14],
  9: [],
  10: [6, 11, 16],
  11: [7, 12, 17],
  12: [8, 13, 18],
  13: [9, 14, 19],
  14: [],
  15: [11, 16],
  16: [12, 17],
  17: [13, 18],
  18: [14, 19],
  19: [],
};

// Source-destination pairs for path generation (including duplicates from original C#)
const PATH_PAIRS: [number, number][] = [
  [0, 2], [0, 3], [0, 4], [0, 7], [0, 8], [0, 9], [0, 12], [0, 13], [0, 14], [0, 18], [0, 19],
  [1, 3], [1, 4], [1, 8], [1, 8], [1, 9], [1, 13], [1, 14], [1, 19],
  [2, 4], [2, 9], [2, 14],
  [5, 2], [5, 3], [5, 4], [5, 7], [5, 8], [5, 9], [5, 12], [5, 13], [5, 14], [5, 17], [5, 18], [5, 19],
  [6, 3], [6, 4], [6, 8], [6, 9], [6, 13], [6, 14], [6, 18], [6, 19],
  [7, 4], [7, 9], [7, 14],
  [10, 2], [10, 3], [10, 4], [10, 7], [10, 8], [10, 9], [10, 12], [10, 13], [10, 14], [10, 17], [10, 18], [10, 17],
  [11, 3], [11, 4], [11, 8], [11, 9], [11, 13], [11, 14], [11, 18], [11, 19],
  [12, 4], [12, 9], [12, 14], [12, 19],
  [15, 7], [15, 3], [15, 4], [15, 8], [15, 9], [15, 12], [15, 13], [15, 14], [15, 17], [15, 18], [15, 19],
  [16, 8], [16, 4], [16, 9], [16, 13], [16, 14], [16, 18], [16, 19],
  [17, 9], [17, 14], [17, 19],
];

function dfs(
  current: number,
  destination: number,
  visited: boolean[],
  path: number[],
  results: number[][]
): void {
  if (current === destination) {
    results.push([...path]);
    return;
  }
  visited[current] = true;
  for (const neighbor of ADJACENCY_LIST[current]) {
    if (!visited[neighbor]) {
      path.push(neighbor);
      dfs(neighbor, destination, visited, path, results);
      path.pop();
    }
  }
  visited[current] = false;
}

function generateAllPaths(source: number, destination: number): number[][] {
  const visited = new Array(20).fill(false);
  const results: number[][] = [];
  const path = [source];
  dfs(source, destination, visited, path, results);
  return results;
}

function pathToString(path: number[]): string {
  return path.join(' ');
}

let cachedPaths: PaylinePath[] | null = null;

export function getPaylinePaths(): PaylinePath[] {
  if (cachedPaths) return cachedPaths;

  const uniquePathStrings = new Set<string>();
  const allPaths: number[][] = [];

  for (const [source, destination] of PATH_PAIRS) {
    const paths = generateAllPaths(source, destination);
    for (const path of paths) {
      const str = pathToString(path);
      if (!uniquePathStrings.has(str)) {
        uniquePathStrings.add(str);
        allPaths.push(path);
      }
    }
  }

  cachedPaths = allPaths.map((path) => ({
    coordinates: path.map((vertex) => SLOTS_MAPPING[vertex]),
  }));

  return cachedPaths;
}

export class PaylineEngine {
  private paths: PaylinePath[];

  constructor() {
    this.paths = getPaylinePaths();
  }

  getPaths(): PaylinePath[] {
    return this.paths;
  }
}
