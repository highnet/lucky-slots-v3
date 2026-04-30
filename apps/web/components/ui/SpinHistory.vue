<template>
  <div class="bg-slate-800 rounded-2xl border border-slate-700 flex flex-col h-96">
    <div class="px-4 py-3 border-b border-slate-700 flex justify-between items-center">
      <h3 class="font-bold text-sm uppercase tracking-wider text-slate-300">Spin History</h3>
      <span class="text-xs text-slate-500">{{ entries.length }} spins</span>
    </div>
    <div ref="scrollRef" class="flex-1 overflow-y-auto p-2 space-y-1">
      <div
        v-for="entry in displayEntries"
        :key="entry.id"
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
        :class="entry.winnings > 0 ? 'bg-emerald-500/10 hover:bg-emerald-500/20' : 'bg-slate-700/50 hover:bg-slate-700'"
      >
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
      <div v-if="entries.length === 0" class="text-center text-slate-500 text-sm py-8">
        No spins yet. Hit SPIN to start!
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';

interface SpinEntry {
  id: string;
  bet: number;
  winnings: number;
  multiplier: number;
  timestamp: string;
}

const props = defineProps<{
  entries: SpinEntry[];
}>();

const scrollRef = ref<HTMLElement | null>(null);

const displayEntries = computed(() => [...props.entries].reverse());

watch(() => props.entries.length, () => {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = 0;
    }
  });
});

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
</script>
