/**
 * @fileoverview PaylineEngine.ts
 *
 * Generates all valid payline paths for an arbitrary N×M grid.
 *
 * A payline is a left-to-right path through the grid where each step moves
 * to the next column and at most one row up or down. Paths must be at least
 * {@link GRID_CONFIG.minMatch} cells long to count as a winning line.
 *
 * The adjacency graph and source-destination pairs are generated dynamically
 * from the grid dimensions. Results are cached per size key so switching
 * between configs is fast after the first call.
 */

import type { Coordinate, PaylinePath } from './types';
import { GRID_CONFIG } from './config';

/** Convert (row, col) to a linear vertex ID. */
function vertexId(row: number, col: number, rows: number): number {
  return col * rows + row;
}

/** Convert a linear vertex ID back to (row, col). */
function fromVertexId(id: number, rows: number): Coordinate {
  return { row: id % rows, col: Math.floor(id / rows) };
}

/** Build the adjacency list for an N×M grid. */
function buildAdjacency(rows: number, cols: number): number[][] {
  const total = rows * cols;
  const adj: number[][] = Array.from({ length: total }, () => []);
  for (let c = 0; c < cols - 1; c++) {
    for (let r = 0; r < rows; r++) {
      const u = vertexId(r, c, rows);
      for (let dr = -1; dr <= 1; dr++) {
        const nr = r + dr;
        if (nr >= 0 && nr < rows) {
          const v = vertexId(nr, c + 1, rows);
          adj[u].push(v);
        }
      }
    }
  }
  return adj;
}

/** Generate all (source, destination) pairs that yield paths ≥ minMatch. */
function buildPathPairs(rows: number, cols: number, minMatch: number): [number, number][] {
  const pairs: [number, number][] = [];
  const minColDist = minMatch - 1;
  for (let sc = 0; sc < cols - minColDist; sc++) {
    for (let sr = 0; sr < rows; sr++) {
      const source = vertexId(sr, sc, rows);
      for (let dc = sc + minColDist; dc < cols; dc++) {
        for (let dr = 0; dr < rows; dr++) {
          const dest = vertexId(dr, dc, rows);
          pairs.push([source, dest]);
        }
      }
    }
  }
  return pairs;
}

/** Depth-first search to enumerate all paths between two vertices. */
function dfs(
  current: number,
  destination: number,
  adj: number[][],
  visited: boolean[],
  path: number[],
  results: number[][]
): void {
  if (current === destination) {
    results.push([...path]);
    return;
  }
  visited[current] = true;
  for (const neighbor of adj[current]) {
    if (!visited[neighbor]) {
      path.push(neighbor);
      dfs(neighbor, destination, adj, visited, path, results);
      path.pop();
    }
  }
  visited[current] = false;
}

/** Generate all unique paths from source to destination. */
function generateAllPaths(source: number, destination: number, adj: number[][], totalVertices: number): number[][] {
  const visited = new Array(totalVertices).fill(false);
  const results: number[][] = [];
  const path = [source];
  dfs(source, destination, adj, visited, path, results);
  return results;
}

/** Stable string key for a path (used for deduplication). */
function pathToString(path: number[]): string {
  return path.join(' ');
}

/** Per-grid-size cache so different configs don't collide. */
const pathCache = new Map<string, PaylinePath[]>();

/**
 * Get (or build) all payline paths for the given grid dimensions.
 *
 * Defaults to the current {@link GRID_CONFIG}.
 */
export function getPaylinePaths(
  rows = GRID_CONFIG.rows,
  cols = GRID_CONFIG.cols,
  minMatch = GRID_CONFIG.minMatch
): PaylinePath[] {
  const cacheKey = `${rows}x${cols}x${minMatch}`;
  if (pathCache.has(cacheKey)) {
    return pathCache.get(cacheKey)!;
  }

  const total = rows * cols;
  const adj = buildAdjacency(rows, cols);
  const pairs = buildPathPairs(rows, cols, minMatch);

  const uniquePathStrings = new Set<string>();
  const allPaths: number[][] = [];

  for (const [source, destination] of pairs) {
    const paths = generateAllPaths(source, destination, adj, total);
    for (const path of paths) {
      const str = pathToString(path);
      if (!uniquePathStrings.has(str)) {
        uniquePathStrings.add(str);
        allPaths.push(path);
      }
    }
  }

  const cachedPaths = allPaths.map((path) => ({
    coordinates: path.map((vertex) => fromVertexId(vertex, rows)),
  }));

  pathCache.set(cacheKey, cachedPaths);
  return cachedPaths;
}

/** Clear the internal path cache (mostly useful for tests). */
export function clearPaylineCache(): void {
  pathCache.clear();
}

/**
 * Wrapper class around {@link getPaylinePaths}.
 *
 * Instantiate once per grid size and reuse for many spins.
 */
export class PaylineEngine {
  private paths: PaylinePath[];

  constructor(rows = GRID_CONFIG.rows, cols = GRID_CONFIG.cols, minMatch = GRID_CONFIG.minMatch) {
    this.paths = getPaylinePaths(rows, cols, minMatch);
  }

  /** Return the precomputed list of valid payline paths. */
  getPaths(): PaylinePath[] {
    return this.paths;
  }
}
