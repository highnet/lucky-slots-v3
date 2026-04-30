import { GRID_CONFIG } from '../src/config';

// Exact counts matching RNG thresholds (out of 100 symbols):
// Ten=45% (450/999), Jack=10% (100/999), Queen=20% (200/999),
// King=13% (130/999), Ace=9% (90/999), Wild=2% (20/999), Bonus=1% (9/999)
interface StripConfig {
  symbol: string;
  count: number;
}

const DISTRIBUTION: StripConfig[] = [
  { symbol: 'TEN', count: 45 },
  { symbol: 'JACK', count: 10 },
  { symbol: 'QUEEN', count: 20 },
  { symbol: 'KING', count: 13 },
  { symbol: 'ACE', count: 9 },
  { symbol: 'WILD', count: 2 },
  { symbol: 'BONUS', count: 1 },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildStrip(seed: number, size: number): string[] {
  const rng = seededRandom(seed);

  const pool: string[] = [];
  for (const item of DISTRIBUTION) {
    for (let i = 0; i < item.count; i++) {
      pool.push(item.symbol);
    }
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, size);
}

function verifyStrip(strip: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const sym of strip) {
    counts[sym] = (counts[sym] || 0) + 1;
  }
  return counts;
}

function generateStrips(reelCount: number, stripSize: number): string[][] {
  const strips: string[][] = [];
  for (let reel = 0; reel < reelCount; reel++) {
    const strip = buildStrip(reel + 42, stripSize);
    strips.push(strip);
  }
  return strips;
}

function toTypeScript(strips: string[][]): string {
  const lines: string[] = [
    "export const REEL_STRIPS: string[][] = [",
  ];

  for (let r = 0; r < strips.length; r++) {
    lines.push(`  // Reel ${r + 1}`);
    lines.push('  [');

    const strip = strips[r];
    for (let i = 0; i < strip.length; i += 10) {
      const chunk = strip.slice(i, i + 10);
      const formatted = chunk.map((s) => `'${s}'`).join(',');
      const lineEnd = i + 10 >= strip.length ? '' : ',';
      lines.push(`    ${formatted}${lineEnd}`);
    }

    const comma = r < strips.length - 1 ? ',' : '';
    lines.push(`  ]${comma}`);
  }

  lines.push('];');
  return lines.join('\n');
}

// Run generator using GRID_CONFIG
const { cols, stripSize } = GRID_CONFIG;
const strips = generateStrips(cols, stripSize);

console.log('=== Reel Strip Generator ===\n');
console.log(`Strip size: ${stripSize}`);
console.log(`Reels: ${cols}\n`);

for (let r = 0; r < strips.length; r++) {
  const counts = verifyStrip(strips[r]);
  console.log(`Reel ${r + 1} distribution:`, counts);
}

console.log('\n=== TypeScript Output ===\n');
console.log(toTypeScript(strips));

console.log('\n=== Verification ===');
let allCorrect = true;
for (let r = 0; r < strips.length; r++) {
  const counts = verifyStrip(strips[r]);
  for (const item of DISTRIBUTION) {
    if (counts[item.symbol] !== item.count) {
      console.error(`Reel ${r + 1}: ${item.symbol} expected ${item.count}, got ${counts[item.symbol]}`);
      allCorrect = false;
    }
  }
}
if (allCorrect) {
  console.log('All strips match the expected distribution.');
}
