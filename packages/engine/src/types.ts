export enum Symbol {
  Ten = 0,
  Jack = 1,
  Queen = 2,
  King = 3,
  Ace = 4,
  Wild = 5,
  Bonus = 6,
}

export const SYMBOL_EMOJIS: Record<Symbol, string> = {
  [Symbol.Ten]: '🔟',
  [Symbol.Jack]: '👦',
  [Symbol.Queen]: '👸',
  [Symbol.King]: '👑',
  [Symbol.Ace]: '🅰️',
  [Symbol.Wild]: '🃏',
  [Symbol.Bonus]: '🎁',
};

export const NUM_ROWS = 4;
export const NUM_REELS = 5;
export const NUM_SYMBOLS = 7;

export interface Coordinate {
  row: number;
  col: number;
}

export interface SpinResult {
  symbols: Symbol[][]; // 4x5 grid
  wildReplacements: Symbol[][][]; // 5 grids of 4x5
}

export interface PaylinePath {
  coordinates: Coordinate[];
}

export interface PayoutResult {
  winnings: number;
  multiplier: number;
  winningPaths: { symbol: Symbol; size: number; coordinates: Coordinate[] }[];
}

// GraphQL enum string names
export const GRAPHQL_SYMBOL_NAMES: Record<Symbol, string> = {
  [Symbol.Ten]: 'TEN',
  [Symbol.Jack]: 'JACK',
  [Symbol.Queen]: 'QUEEN',
  [Symbol.King]: 'KING',
  [Symbol.Ace]: 'ACE',
  [Symbol.Wild]: 'WILD',
  [Symbol.Bonus]: 'BONUS',
};

export function symbolsToGraphQL(symbols: Symbol[][]): string[][] {
  return symbols.map((row) => row.map((s) => GRAPHQL_SYMBOL_NAMES[s]));
}
