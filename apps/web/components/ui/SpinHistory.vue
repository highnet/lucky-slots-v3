<template>
  <div class="bg-slate-800 rounded-2xl border border-slate-700 flex flex-col h-[28rem] sm:h-[32rem] lg:h-[36rem]">
    <div class="px-4 py-3 border-b border-slate-700 flex justify-between items-center shrink-0">
      <h3 class="font-bold text-sm uppercase tracking-wider text-slate-300">Spin History</h3>
      <span class="text-xs text-slate-500">{{ entries.length }} spins</span>
    </div>
    <div ref="scrollRef" class="flex-1 overflow-y-auto p-2 space-y-2">
      <div v-if="entries.length === 0" class="text-center text-slate-500 text-sm py-8">
        No spins yet. Hit SPIN to start!
      </div>

      <div
        v-for="entry in entries"
        :key="entry.id"
        class="rounded-lg text-sm transition-colors overflow-hidden"
        :class="entry.winnings > 0 ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20' : 'bg-slate-700/50 hover:bg-slate-700 border border-transparent'"
      >
        <!-- Header row -->
        <div class="flex items-center gap-3 px-3 py-2">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0"
            :class="entry.winnings > 0 ? 'bg-emerald-500/20' : 'bg-slate-600'"
          >
            {{ entry.winnings > 0 ? '🎉' : '🌀' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline">
              <span class="font-medium truncate">
                <span class="text-slate-400">Bet</span> ${{ entry.bet.toFixed(2) }}
              </span>
              <span class="text-xs text-slate-500">{{ formatTime(entry.timestamp) }}</span>
            </div>
            <div v-if="entry.winnings > 0" class="text-emerald-400 font-semibold">
              Won ${{ entry.winnings.toFixed(2) }} <span class="text-xs text-emerald-500/70">(x{{ entry.multiplier }})</span>
            </div>
            <div v-else class="text-slate-400">
              No win
            </div>
          </div>
        </div>

        <!-- Mini grid + breakdown (only for wins) -->
        <div v-if="entry.winnings > 0 && entry.symbols.length > 0" class="px-3 pb-3">
          <!-- Mini symbol grid -->
          <div class="mb-2">
            <div class="inline-grid gap-0.5" :style="gridStyle(entry.symbols)">
              <div
                v-for="(cell, idx) in flattenGrid(entry.symbols, entry.winningPaths)"
                :key="idx"
                class="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center text-xs"
                :class="cell.isWin ? 'bg-amber-500/30 border border-amber-400/50' : 'bg-slate-700/60'"
              >
                {{ cell.emoji }}
              </div>
            </div>
          </div>

          <!-- Payline breakdown -->
          <div class="space-y-1">
            <div
              v-for="(wp, idx) in entry.winningPaths"
              :key="idx"
              class="flex items-center justify-between text-xs px-2 py-1 rounded bg-slate-900/40"
            >
              <div class="flex items-center gap-2">
                <span class="text-base">{{ symbolEmoji(wp.symbol) }}</span>
                <span class="text-slate-300">{{ wp.symbol }}</span>
                <span class="text-slate-500">{{ wp.size }} in a row</span>
              </div>
              <span class="text-emerald-400 font-medium">
                x{{ getMultiplier(wp.size, wp.symbol) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { GRAPHQL_EMOJIS, getMultiplier } from '@lucky-slots/engine';

interface SpinEntry {
  id: string;
  bet: number;
  winnings: number;
  multiplier: number;
  timestamp: string;
  symbols: string[][];
  winningPaths: {
    symbol: string;
    size: number;
    coordinates: { row: number; col: number }[];
  }[];
}

const props = defineProps<{
  entries: SpinEntry[];
}>();

const scrollRef = ref<HTMLElement | null>(null);

function symbolEmoji(name: string): string {
  return GRAPHQL_EMOJIS[name] ?? '❓';
}

function gridStyle(symbols: string[][]) {
  const cols = symbols[0]?.length ?? 0;
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  };
}

function flattenGrid(
  symbols: string[][],
  winningPaths: SpinEntry['winningPaths']
) {
  const winCells = new Set<string>();
  for (const wp of winningPaths) {
    for (const c of wp.coordinates) {
      winCells.add(`${c.row},${c.col}`);
    }
  }

  const cells: { emoji: string; isWin: boolean }[] = [];
  for (let row = 0; row < symbols.length; row++) {
    for (let col = 0; col < symbols[row].length; col++) {
      cells.push({
        emoji: symbolEmoji(symbols[row][col]),
        isWin: winCells.has(`${row},${col}`),
      });
    }
  }
  return cells;
}

// Auto-scroll to bottom when entries change (newest at bottom)
watch(() => props.entries.length, () => {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
    }
  });
});

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
</script>
