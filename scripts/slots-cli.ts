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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = resolve(__dirname, '../packages/engine/src');
const CONFIG_PATH = resolve(ENGINE_DIR, 'config.ts');

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

  // Verify write succeeded by re-reading the file
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

  // Auto-regenerate strips
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
