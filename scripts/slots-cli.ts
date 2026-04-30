#!/usr/bin/env tsx
/**
 * @fileoverview slots-cli.ts
 *
 * Interactive TUI for managing the Lucky Slots engine.
 *
 * Usage:
 *   pnpm cli
 *   pnpm slots-cli
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import prompts from 'prompts';
import { RTPSimulator, RTPBalancer } from '@lucky-slots/engine';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = resolve(__dirname, '../packages/engine/src');
const CONFIG_PATH = resolve(ENGINE_DIR, 'config.ts');
const CONSTANTS_PATH = resolve(ENGINE_DIR, 'constants.ts');

interface GridConfig {
  rows: number;
  cols: number;
  minMatch: number;
  numSymbols: number;
  stripSize: number;
  paylineSymbols: number;
}

function parseConfig(): GridConfig {
  const content = readFileSync(CONFIG_PATH, 'utf-8');
  const config = {} as GridConfig;
  const keys = ['rows', 'cols', 'minMatch', 'numSymbols', 'stripSize', 'paylineSymbols'];
  for (const key of keys) {
    const regex = new RegExp(`^[ \\t]*${key}:[ \\t]*(\\d+)`, 'm');
    const match = content.match(regex);
    if (match) {
      (config as any)[key] = parseInt(match[1], 10);
    }
  }
  return config;
}

function writeConfig(updates: Partial<GridConfig>): void {
  const lines = readFileSync(CONFIG_PATH, 'utf-8').split('\n');
  const out: string[] = [];

  for (const line of lines) {
    let replaced = line;
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^([ \\t]*${key}:[ \\t]*)\\d+`);
      if (regex.test(replaced)) {
        replaced = replaced.replace(regex, `$1${value}`);
      }
    }
    out.push(replaced);
  }

  writeFileSync(CONFIG_PATH, out.join('\n'), 'utf-8');
}

function run(cmd: string, cwd?: string): void {
  execSync(cmd, { cwd: cwd || process.cwd(), stdio: 'inherit' });
}

function printConfig(config: GridConfig): void {
  console.log('\n  ┌────────────────────────────────┐');
  console.log('  │      Grid Configuration        │');
  console.log('  ├────────────────────────────────┤');
  console.log(`  │  rows:           ${String(config.rows).padEnd(15)}│`);
  console.log(`  │  cols:           ${String(config.cols).padEnd(15)}│`);
  console.log(`  │  minMatch:       ${String(config.minMatch).padEnd(15)}│`);
  console.log(`  │  numSymbols:     ${String(config.numSymbols).padEnd(15)}│`);
  console.log(`  │  stripSize:      ${String(config.stripSize).padEnd(15)}│`);
  console.log(`  │  paylineSymbols: ${String(config.paylineSymbols).padEnd(15)}│`);
  console.log('  └────────────────────────────────┘\n');
}

async function menuUpdateConfig(): Promise<void> {
  const config = parseConfig();

  const fields = [
    { name: 'rows', label: 'Rows (displayed per reel)', value: config.rows },
    { name: 'cols', label: 'Cols (number of reels)', value: config.cols },
    { name: 'minMatch', label: 'Min Match (minimum path length)', value: config.minMatch },
    { name: 'stripSize', label: 'Strip Size (symbols per reel strip)', value: config.stripSize },
    { name: 'paylineSymbols', label: 'Payline Symbols (Ten→Ace count)', value: config.paylineSymbols },
  ];

  const response = await prompts(fields.map((f) => ({
    type: 'number' as const,
    name: f.name,
    message: f.label,
    initial: f.value,
    min: 1,
  })));

  if (Object.keys(response).length === 0) {
    console.log('\n  Cancelled.\n');
    return;
  }

  const updates: Partial<GridConfig> = {};
  for (const f of fields) {
    const val = response[f.name];
    if (typeof val === 'number' && val !== f.value) {
      updates[f.name as keyof GridConfig] = val;
    }
  }

  if (Object.keys(updates).length === 0) {
    console.log('\n  No changes made.\n');
    return;
  }

  writeConfig(updates);

  const after = parseConfig();
  let verified = true;
  for (const [k, v] of Object.entries(updates)) {
    if ((after as any)[k] !== v) {
      console.error(`  ERROR: ${k} was not updated (expected ${v}, got ${(after as any)[k]})`);
      verified = false;
    }
  }

  if (!verified) {
    console.log('\n  Config update failed. Please check file permissions.\n');
    return;
  }

  console.log('\n  Updated config.ts:');
  for (const [k, v] of Object.entries(updates)) {
    console.log(`    ${k}: ${v}`);
  }

  console.log('\n  Auto-regenerating reel strips...\n');
  try {
    run('pnpm --filter @lucky-slots/engine update-strips');
    console.log('\n  Config + strips updated successfully!\n');
  } catch {
    console.log('\n  Config updated, but strip regeneration failed.\n');
  }
}

async function menuRegenerateStrips(): Promise<void> {
  console.log('\n  Regenerating reel strips...\n');
  try {
    run('pnpm --filter @lucky-slots/engine update-strips');
    console.log('\n  Strips regenerated successfully.\n');
  } catch {
    console.log('\n  Strip regeneration failed.\n');
  }
}

async function menuMigrate(): Promise<void> {
  console.log('\n  Running database migrations...\n');
  try {
    run('pnpm --filter @lucky-slots/api db:push');
    console.log('\n  Migrations complete.\n');
  } catch {
    console.log('\n  Migrations failed.\n');
  }
}

async function menuBuild(): Promise<void> {
  console.log('\n  Building all packages...\n');
  try {
    run('pnpm build');
    console.log('\n  Build complete.\n');
  } catch {
    console.log('\n  Build failed.\n');
  }
}

async function menuDev(): Promise<void> {
  console.log('\n  Starting dev servers...');
  console.log('  API:  http://localhost:4000/graphql');
  console.log('  Web:  http://localhost:3000');
  console.log('  Press Ctrl+C to stop.\n');
  try {
    run('pnpm dev');
  } catch {
    /* dev server exits on Ctrl+C */
  }
}

async function menuSetup(): Promise<void> {
  console.log('\n  Running full setup...\n');
  await menuRegenerateStrips();
  await menuMigrate();
  await menuBuild();
  console.log('\n  Setup complete! Run "Start Dev" to begin.\n');
}

async function menuAnalyzeRTP(): Promise<void> {
  const config = parseConfig();
  const simResponse = await prompts({
    type: 'number',
    name: 'spins',
    message: 'Number of spins to simulate',
    initial: 100_000,
    min: 1000,
  });

  if (typeof simResponse.spins !== 'number') {
    console.log('\n  Cancelled.\n');
    return;
  }

  console.log(`\n  Running Monte Carlo simulation (${simResponse.spins.toLocaleString()} spins)...`);
  console.log(`  Grid: ${config.rows}×${config.cols}, minMatch=${config.minMatch}\n`);

  const sim = new RTPSimulator({
    rows: config.rows,
    cols: config.cols,
    minMatch: config.minMatch,
    paylineSymbols: config.paylineSymbols,
    thresholds: { ten: 450, jack: 550, queen: 750, king: 880, ace: 970, wild: 990, bonus: 999 },
    multipliers: {},
  });

  const result = sim.run(simResponse.spins, 1.0, Date.now());

  console.log('  ┌──────────────────────────────────────────┐');
  console.log('  │         RTP Analysis Results             │');
  console.log('  ├──────────────────────────────────────────┤');
  console.log(`  │  RTP:               ${result.rtp.toFixed(2)}%${' '.repeat(14 - result.rtp.toFixed(2).length)}│`);
  console.log(`  │  Hit Frequency:     ${(result.hitFrequency * 100).toFixed(2)}%${' '.repeat(14 - (result.hitFrequency * 100).toFixed(2).length)}│`);
  console.log(`  │  Avg Multiplier:    ${result.avgMultiplier.toFixed(3)}${' '.repeat(15 - result.avgMultiplier.toFixed(3).length)}│`);
  console.log(`  │  Max Multiplier:    ${result.maxMultiplier.toFixed(2)}${' '.repeat(15 - result.maxMultiplier.toFixed(2).length)}│`);
  console.log(`  │  Variance:          ${result.variance.toFixed(4)}${' '.repeat(15 - result.variance.toFixed(4).length)}│`);
  console.log(`  │  95% CI:            ±${result.confidenceInterval.toFixed(3)}%${' '.repeat(13 - result.confidenceInterval.toFixed(3).length)}│`);
  console.log('  ├──────────────────────────────────────────┤');
  console.log('  │  Per-Symbol RTP Contribution             │');
  const sortedSymbols = Object.entries(result.perSymbolRTP).sort((a, b) => b[1] - a[1]);
  for (const [sym, rtp] of sortedSymbols) {
    const line = `${sym}: ${rtp.toFixed(2)}%`;
    console.log(`  │  ${line.padEnd(38)}│`);
  }
  console.log('  └──────────────────────────────────────────┘\n');
}

async function menuBalanceRTP(): Promise<void> {
  const config = parseConfig();

  const targetResponse = await prompts([
    {
      type: 'number',
      name: 'target',
      message: 'Target RTP % (e.g. 49 for 49%)',
      initial: 49,
      min: 1,
      max: 99,
    },
    {
      type: 'number',
      name: 'tolerance',
      message: 'Tolerance ±% (default 1.0)',
      initial: 1.0,
      min: 0.1,
      max: 10,
    },
    {
      type: 'number',
      name: 'maxIters',
      message: 'Max iterations (default 100)',
      initial: 100,
      min: 10,
      max: 500,
    },
  ]);

  if (typeof targetResponse.target !== 'number') {
    console.log('\n  Cancelled.\n');
    return;
  }

  console.log(`\n  Balancing RTP toward ${targetResponse.target}% (±${targetResponse.tolerance}%)...`);
  console.log(`  Grid: ${config.rows}×${config.cols}\n`);

  const result = RTPBalancer.balance(
    targetResponse.target,
    targetResponse.tolerance,
    targetResponse.maxIters,
    {
      rows: config.rows,
      cols: config.cols,
      minMatch: config.minMatch,
      paylineSymbols: config.paylineSymbols,
    }
  );

  console.log('  ┌──────────────────────────────────────────┐');
  console.log('  │         Balance Report                   │');
  console.log('  ├──────────────────────────────────────────┤');
  console.log(`  │  Converged:   ${result.converged ? 'YES' : 'NO'}${' '.repeat(26)}│`);
  console.log(`  │  Iterations:  ${result.iterations}${' '.repeat(28 - String(result.iterations).length)}│`);
  console.log(`  │  Final RTP:   ${result.finalRTP.toFixed(2)}%${' '.repeat(25 - result.finalRTP.toFixed(2).length)}│`);
  console.log(`  │  Target RTP:  ${result.targetRTP.toFixed(1)}%${' '.repeat(25 - result.targetRTP.toFixed(1).length)}│`);
  console.log('  ├──────────────────────────────────────────┤');
  console.log('  │  Optimized Thresholds                    │');
  for (const [k, v] of Object.entries(result.thresholds)) {
    console.log(`  │  ${k.padEnd(8)} ${String(v).padStart(4)}  (${((v - (result.thresholds as any)[getPrevKey(k, result.thresholds)]) / 9.99).toFixed(1)}%)${' '.repeat(14)}│`);
  }
  console.log('  ├──────────────────────────────────────────┤');
  console.log('  │  Optimized Multipliers                   │');
  for (const [k, v] of Object.entries(result.multipliers)) {
    console.log(`  │  ${k.padEnd(15)} x${v.toFixed(3)}${' '.repeat(20 - k.length - v.toFixed(3).length)}│`);
  }
  console.log('  └──────────────────────────────────────────┘\n');

  const apply = await prompts({
    type: 'confirm',
    name: 'yes',
    message: 'Apply these changes to config?',
    initial: false,
  });

  if (apply.yes) {
    await applyBalanceResult(result);
  }
}

function getPrevKey(key: string, thresholds: Record<string, number>): string {
  const order = ['ten', 'jack', 'queen', 'king', 'ace', 'wild', 'bonus'];
  const idx = order.indexOf(key);
  return idx <= 0 ? 'ten' : order[idx - 1];
}

async function applyBalanceResult(result: ReturnType<typeof RTPBalancer.balance>): Promise<void> {
  // Read current constants.ts
  let content = readFileSync(CONSTANTS_PATH, 'utf-8');

  // Update THRESHOLDS
  const threshEntries = Object.entries(result.thresholds)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join(',\n');

  content = content.replace(
    /export const THRESHOLDS = \{[\s\S]*?\} as const;/,
    `export const THRESHOLDS = {\n${threshEntries}\n} as const;`
  );

  // Update MULTIPLIERS
  const multEntries = Object.entries(result.multipliers)
    .map(([k, v]) => `  '${k}': ${v.toFixed(4)},`)
    .join('\n');

  content = content.replace(
    /const HARDCODED_MULTIPLIERS: Record<string, number> = \{[\s\S]*?\};/,
    `const HARDCODED_MULTIPLIERS: Record<string, number> = {\n${multEntries}\n};`
  );

  writeFileSync(CONSTANTS_PATH, content, 'utf-8');
  console.log('\n  Updated constants.ts with balanced values.\n');

  // Regenerate strips
  console.log('  Auto-regenerating reel strips...\n');
  try {
    run('pnpm --filter @lucky-slots/engine update-strips');
    console.log('\n  Balance applied successfully! Run "Build All" to compile.\n');
  } catch {
    console.log('\n  Constants updated but strip regeneration failed.\n');
  }
}

async function main(): Promise<void> {
  let running = true;

  while (running) {
    const config = parseConfig();

    const response = await prompts({
      type: 'select',
      name: 'action',
      message: 'Lucky Slots CLI',
      choices: [
        { title: 'Show Config', value: 'config' },
        { title: 'Update Config', value: 'update' },
        { title: 'Regenerate Strips', value: 'strips' },
        { title: 'Analyze RTP', value: 'analyzeRTP' },
        { title: 'Balance RTP', value: 'balanceRTP' },
        { title: 'Run Migrations', value: 'migrate' },
        { title: 'Build All', value: 'build' },
        { title: 'Start Dev', value: 'dev' },
        { title: 'Full Setup', value: 'setup' },
        { title: 'Exit', value: 'exit' },
      ],
    });

    switch (response.action) {
      case 'config':
        printConfig(config);
        break;
      case 'update':
        await menuUpdateConfig();
        break;
      case 'strips':
        await menuRegenerateStrips();
        break;
      case 'analyzeRTP':
        await menuAnalyzeRTP();
        break;
      case 'balanceRTP':
        await menuBalanceRTP();
        break;
      case 'migrate':
        await menuMigrate();
        break;
      case 'build':
        await menuBuild();
        break;
      case 'dev':
        await menuDev();
        break;
      case 'setup':
        await menuSetup();
        break;
      case 'exit':
      default:
        running = false;
        console.log('\n  Goodbye!\n');
        break;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
