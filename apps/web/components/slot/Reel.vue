<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(cell, rowIdx) in displayCells"
      :key="rowIdx"
      class="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-3xl sm:text-4xl rounded-xl border-2 transition-all duration-300 overflow-hidden relative"
      :class="cell.containerClass"
    >
      <!-- Spinning blur overlay -->
      <div
        v-if="isSpinning"
        class="absolute inset-0 bg-slate-600/30 animate-pulse"
      />
      <span
        class="inline-block transition-transform duration-200 z-10"
        :class="{ 'animate-reel-bounce': isSpinning }"
      >
        {{ cell.emoji }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const GRAPHQL_EMOJIS: Record<string, string> = {
  TEN: '🔟',
  JACK: '👦',
  QUEEN: '👸',
  KING: '👑',
  ACE: '🅰️',
  WILD: '🃏',
  BONUS: '🎁',
};

const props = defineProps<{
  symbols: string[]; // 4 symbols for this reel column
  isSpinning: boolean;
  isWinner: boolean[]; // 4 booleans for each row
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
