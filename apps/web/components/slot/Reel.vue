<template>
  <div class="flex flex-col gap-1 sm:gap-1.5">
    <div
      v-for="(cell, rowIdx) in displayCells"
      :key="rowIdx"
      class="flex items-center justify-center rounded-md sm:rounded-lg border-2 transition-all duration-300 overflow-hidden relative aspect-square"
      :class="cell.containerClass"
      :style="cellStyle"
    >
      <div
        v-if="isSpinning"
        class="absolute inset-0 bg-slate-600/30 animate-pulse"
      />
      <span
        class="inline-block transition-transform duration-200 z-10 leading-none select-none"
        :class="{ 'animate-reel-bounce': isSpinning }"
        :style="emojiStyle"
      >
        {{ cell.emoji }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { GRAPHQL_EMOJIS } from '@lucky-slots/engine';

const props = defineProps<{
  symbols: string[];
  isSpinning: boolean;
  isWinner: boolean[];
  gridCols: number;
  gridRows: number;
}>();

const displayCells = computed(() => {
  return props.symbols.map((name, rowIdx) => {
    const emoji = GRAPHQL_EMOJIS[name] ?? '❓';
    let containerClass = 'bg-slate-700 border-slate-600';

    if (props.isSpinning) {
      containerClass = 'bg-slate-700/80 border-slate-500 blur-[1px]';
    } else if (props.isWinner[rowIdx]) {
      containerClass = 'bg-amber-500/40 border-amber-400 shadow-lg shadow-amber-500/30 scale-105';
    }

    return { emoji, containerClass };
  });
});

// Compute cell size based on grid density.
// More cells = smaller cells. We use CSS clamp for fluid scaling.
const cellSize = computed(() => {
  const density = props.gridCols * props.gridRows;
  if (density <= 9) return 'clamp(3rem, 12vw, 5.5rem)';
  if (density <= 16) return 'clamp(2.5rem, 10vw, 4.5rem)';
  if (density <= 30) return 'clamp(2rem, 8vw, 3.5rem)';
  if (density <= 50) return 'clamp(1.5rem, 6vw, 2.5rem)';
  return 'clamp(1.25rem, 5vw, 2rem)';
});

const cellStyle = computed(() => ({
  width: cellSize.value,
  height: cellSize.value,
}));

const emojiStyle = computed(() => ({
  fontSize: `calc(${cellSize.value} * 0.55)`,
}));
</script>

<style scoped>
@keyframes reel-bounce {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-3px); }
  75% { transform: translateY(3px); }
}
.animate-reel-bounce {
  animation: reel-bounce 0.12s ease-in-out infinite;
}
</style>
