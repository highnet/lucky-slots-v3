/**
 * @fileoverview index.ts
 *
 * Public API surface of the @lucky-slots/engine package.
 *
 * Import everything from here:
 *   import { SpinEngine, PaylineEngine, PayoutEngine, GRID_CONFIG } from '@lucky-slots/engine';
 */

export * from './config';
export * from './types';
export * from './constants';
export * from './SpinEngine';
export * from './PaylineEngine';
export * from './PayoutEngine';
export * from './ProvablyFairRng';
export * from './RTPSimulator';

// Run critical safety validations at module load time.
// This will throw a fatal error if the engine is misconfigured.
import './validate';
