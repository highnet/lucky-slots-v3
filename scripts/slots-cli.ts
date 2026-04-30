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
import { RTPSimulator } from '@lucky-slots/engine';

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

function parseReelStrips(): string[][] {
  const content = readFileSync(CONSTANTS_PATH, 'utf-8');
  const match = content.match(/export const REEL_STRIPS: string\[\]\[\] = \[([\s\S]*?)\];/);
  if (!match) return [];

  const strips: string[][] = [];
  const raw = match[1];
  // Split by reel comments and parse each reel's array
  const reelBlocks = raw.split(/\/\/ Reel \d+/).filter((b) => b.trim());

  for (const block of reelBlocks) {
    const strip: string[] = [];
    const lines = block.split('\n');
    for (const line of lines) {
      const symbols = line.match(/'([A-Z]+)'/g);
      if (symbols) {
        for (const s of symbols) {
          strip.push(s.replace(/'/g, ''));
        }
      }
    }
    if (strip.length > 0) strips.push(strip);
  }
  return strips;
}

function parseMultipliers(): Record<string, number> {
  const content = readFileSync(CONSTANTS_PATH, 'utf-8');
  const match = content.match(/const HARDCODED_MULTIPLIERS: Record<string, number> = \{([\s\S]*?)\};/);
  if (!match) return {};
  const multipliers: Record<string, number> = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const m = line.match(/^[ \t]*'([^']+)':[ \t]*([0-9.]+)/);
    if (m) {
      multipliers[m[1]] = parseFloat(m[2]);
    }
  }
  return multipliers;
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
  console.log(`  Grid: ${config.rows}x${config.cols}, minMatch=${config.minMatch}\n`);

  const reelStrips = parseReelStrips();
  const multipliers = parseMultipliers();

  if (reelStrips.length === 0) {
    console.log('  ERROR: Could not parse REEL_STRIPS from constants.ts');
    console.log('  Run "Regenerate Strips" first.\n');
    return;
  }

  const sim = new RTPSimulator({
    rows: config.rows,
    cols: config.cols,
    minMatch: config.minMatch,
    paylineSymbols: config.paylineSymbols,
    reelStrips,
    multipliers,
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

async function menuOptimizeStrips(): Promise<void> {
  const config = parseConfig();

  const targetResponse = await prompts([
    {
      type: 'number',
      name: 'targetRTP',
      message: 'Target RTP % (e.g. 49 for 49%)',
      initial: 49,
      min: 1,
      max: 99,
    },
    {
      type: 'number',
      name: 'targetHitRate',
      message: 'Target Hit-Rate % (e.g. 20 for 20%)',
      initial: 20,
      min: 1,
      max: 99,
    },
    {
      type: 'number',
      name: 'iterations',
      message: 'Optimizer iterations (default 200)',
      initial: 200,
      min: 10,
      max: 500,
    },
  ]);

  if (typeof targetResponse.targetRTP !== 'number') {
    console.log('\n  Cancelled.\n');
    return;
  }

  console.log(`\n  Optimizing strips toward RTP=${targetResponse.targetRTP}% hitRate=${targetResponse.targetHitRate}%...`);
  console.log(`  Grid: ${config.rows}x${config.cols}\n`);

  const env = {
    TARGET_RTP: String(targetResponse.targetRTP),
    TARGET_HITRATE: String(targetResponse.targetHitRate / 100),
    OPT_ITERATIONS: String(targetResponse.iterations ?? 200),
    OPT_SPINS: '10000',
    WRITE_CONSTANTS: '1',
  };

  const envStr = Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ');

  try {
    run(`${envStr} pnpm --filter @lucky-slots/engine optimize-strips`);
    console.log('\n  Optimization complete! Run "Build All" to compile.\n');
  } catch {
    console.log('\n  Optimization failed.\n');
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
        { title: 'Optimize Strips', value: 'optimize' },
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
      case 'optimize':
        await menuOptimizeStrips();
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
