/**
 * @fileoverview validate.ts
 *
 * Critical safety validation for the entire engine configuration.
 *
 * These checks run once at module load time. Any misconfiguration throws
 * a fatal error immediately so the developer knows something is wrong
 * before a single spin is executed.
 */

import { GRID_CONFIG } from './config';
import { Symbol, GRAPHQL_SYMBOL_NAMES, NUM_ROWS, NUM_REELS, NUM_SYMBOLS } from './types';
import { REEL_STRIPS, THRESHOLDS, MULTIPLIERS, getMultiplier, BET_AMOUNTS, DEFAULT_BALANCE, DEFAULT_BET } from './constants';

class EngineFatalError extends Error {
  constructor(message: string) {
    super(`[ENGINE FATAL] ${message}`);
    this.name = 'EngineFatalError';
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new EngineFatalError(message);
  }
}

function validateGridConfig(): void {
  const { rows, cols, minMatch, stripSize, numSymbols, paylineSymbols } = GRID_CONFIG;

  assert(Number.isInteger(rows) && rows >= 1 && rows <= 20,
    `GRID_CONFIG.rows must be an integer between 1 and 20, got ${rows}`);
  assert(Number.isInteger(cols) && cols >= 1 && cols <= 20,
    `GRID_CONFIG.cols must be an integer between 1 and 20, got ${cols}`);
  assert(Number.isInteger(minMatch) && minMatch >= 1,
    `GRID_CONFIG.minMatch must be a positive integer, got ${minMatch}`);
  assert(Number.isInteger(stripSize) && stripSize >= 1,
    `GRID_CONFIG.stripSize must be a positive integer, got ${stripSize}`);
  assert(Number.isInteger(numSymbols) && numSymbols >= 1,
    `GRID_CONFIG.numSymbols must be a positive integer, got ${numSymbols}`);
  assert(Number.isInteger(paylineSymbols) && paylineSymbols >= 1,
    `GRID_CONFIG.paylineSymbols must be a positive integer, got ${paylineSymbols}`);

  assert(minMatch <= cols,
    `GRID_CONFIG.minMatch (${minMatch}) cannot exceed cols (${cols}). A path cannot be longer than the number of reels.`);
  assert(stripSize >= rows,
    `GRID_CONFIG.stripSize (${stripSize}) must be >= rows (${rows}) so the reel window can display at least one full column.`);
  assert(paylineSymbols <= numSymbols,
    `GRID_CONFIG.paylineSymbols (${paylineSymbols}) cannot exceed numSymbols (${numSymbols}).`);
  assert(rows * cols <= 200,
    `Grid size (${rows}×${cols} = ${rows * cols}) exceeds the maximum allowed 200 cells to prevent memory exhaustion.`);
}

function validateSymbolEnum(): void {
  const enumKeys = Object.keys(Symbol).filter((k) => isNaN(Number(k)));
  const enumValues = enumKeys.map((k) => (Symbol as any)[k]).filter((v) => typeof v === 'number');

  assert(enumValues.length === NUM_SYMBOLS,
    `Symbol enum has ${enumValues.length} numeric entries but GRID_CONFIG.numSymbols is ${NUM_SYMBOLS}.`);

  for (const sym of enumValues) {
    const name = GRAPHQL_SYMBOL_NAMES[sym as Symbol];
    assert(name !== undefined,
      `Missing GRAPHQL_SYMBOL_NAMES entry for Symbol value ${sym}.`);
    assert(typeof name === 'string' && name.length > 0,
      `GRAPHQL_SYMBOL_NAMES[${sym}] must be a non-empty string.`);
  }
}

function validateReelStrips(): void {
  assert(Array.isArray(REEL_STRIPS),
    'REEL_STRIPS must be an array.');
  assert(REEL_STRIPS.length === NUM_REELS,
    `REEL_STRIPS has ${REEL_STRIPS.length} reels but GRID_CONFIG.cols is ${NUM_REELS}. Run "pnpm update-strips" to regenerate.`);

  const validSymbolNames = new Set(Object.values(GRAPHQL_SYMBOL_NAMES));

  for (let reel = 0; reel < REEL_STRIPS.length; reel++) {
    const strip = REEL_STRIPS[reel];
    assert(Array.isArray(strip),
      `REEL_STRIPS[${reel}] must be an array.`);
    assert(strip.length === GRID_CONFIG.stripSize,
      `REEL_STRIPS[${reel}] has length ${strip.length} but GRID_CONFIG.stripSize is ${GRID_CONFIG.stripSize}.`);

    for (let i = 0; i < strip.length; i++) {
      const sym = strip[i];
      assert(typeof sym === 'string',
        `REEL_STRIPS[${reel}][${i}] must be a string, got ${typeof sym}.`);
      assert(validSymbolNames.has(sym),
        `REEL_STRIPS[${reel}][${i}] = "${sym}" is not a valid symbol name. Valid: ${[...validSymbolNames].join(', ')}.`);
    }
  }
}

function validateThresholds(): void {
  const entries = Object.entries(THRESHOLDS);
  assert(entries.length === NUM_SYMBOLS,
    `THRESHOLDS has ${entries.length} entries but numSymbols is ${NUM_SYMBOLS}.`);

  let prev = -1;
  for (const [name, value] of entries) {
    assert(Number.isInteger(value) && value > prev,
      `THRESHOLDS.${name} (${value}) must be an integer strictly greater than the previous threshold (${prev}).`);
    prev = value;
  }

  assert(prev === 999,
    `Last THRESHOLD must be exactly 999 (covers full RNG range 0-999), got ${prev}.`);
}

/** Title-case names used in MULTIPLIERS keys (e.g. "Ten", "Ace"). */
const PAYLINE_SYMBOL_TITLES = ['Ten', 'Jack', 'Queen', 'King', 'Ace'];

function validateMultipliers(): void {
  const validNames = PAYLINE_SYMBOL_TITLES.slice(0, GRID_CONFIG.paylineSymbols);

  // Validate hardcoded keys are well-formed
  for (const key of Object.keys(MULTIPLIERS)) {
    const match = key.match(/^(\d+)\s+(.+)$/);
    assert(match !== null,
      `MULTIPLIERS key "${key}" is invalid. Expected format: "{size} {SymbolName}" (e.g. "5 Ace").`);

    const size = parseInt(match![1], 10);
    const symName = match![2];

    assert(Number.isInteger(size) && size >= 1,
      `MULTIPLIERS key "${key}" has invalid size ${size}. Must be a positive integer.`);
    assert(validNames.includes(symName),
      `MULTIPLIERS key "${key}" references unknown symbol "${symName}". Valid payline symbols: ${validNames.join(', ')}.`);
    assert(typeof MULTIPLIERS[key] === 'number' && MULTIPLIERS[key] >= 0,
      `MULTIPLIERS["${key}"] must be a non-negative number, got ${MULTIPLIERS[key]}.`);
  }

  // Verify the auto-repair system can resolve every valid combination for the current grid.
  // This ensures the engine is always playable regardless of which multipliers are hardcoded.
  for (const symName of validNames) {
    for (let size = GRID_CONFIG.minMatch; size <= GRID_CONFIG.cols; size++) {
      const val = getMultiplier(size, symName);
      assert(typeof val === 'number' && val >= 0 && isFinite(val),
        `Auto-repair failed for "${size} ${symName}". getMultiplier returned ${val}.`);
    }
  }
}

function validateBetConfig(): void {
  assert(Array.isArray(BET_AMOUNTS) && BET_AMOUNTS.length > 0,
    'BET_AMOUNTS must be a non-empty array.');

  for (let i = 0; i < BET_AMOUNTS.length; i++) {
    assert(typeof BET_AMOUNTS[i] === 'number' && BET_AMOUNTS[i] > 0,
      `BET_AMOUNTS[${i}] must be a positive number, got ${BET_AMOUNTS[i]}.`);
    if (i > 0) {
      assert(BET_AMOUNTS[i] > BET_AMOUNTS[i - 1],
        `BET_AMOUNTS must be strictly ascending. ${BET_AMOUNTS[i]} is not > ${BET_AMOUNTS[i - 1]}.`);
    }
  }

  assert(typeof DEFAULT_BALANCE === 'number' && DEFAULT_BALANCE > 0,
    `DEFAULT_BALANCE must be positive, got ${DEFAULT_BALANCE}.`);
  assert(typeof DEFAULT_BET === 'number' && DEFAULT_BET > 0 && BET_AMOUNTS.includes(DEFAULT_BET as any),
    `DEFAULT_BET (${DEFAULT_BET}) must be one of the allowed BET_AMOUNTS.`);
}

/**
 * Run all validations. Called automatically when the engine module is imported.
 */
function runValidations(): void {
  validateGridConfig();
  validateSymbolEnum();
  validateReelStrips();
  validateThresholds();
  validateMultipliers();
  validateBetConfig();
}

runValidations();
