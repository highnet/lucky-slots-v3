<!-- Primary action button that triggers a spin mutation and advances the game phase. -->
<template>
  <button
    @click="handleSpin"
    :disabled="gameStore.isSpinning"
    class="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg shadow-lg shadow-blue-900/50 transition-all active:scale-95"
  >
    {{ gameStore.isSpinning ? 'Spinning...' : 'SPIN' }}
  </button>
</template>

<script setup lang="ts">
const { spin } = useGameState();
const gameStore = useGameStore();

async function handleSpin() {
  if (gameStore.isSpinning) return;
  try {
    await spin();
    // Simple animation flow
    gameStore.setPhase('calculating');
    setTimeout(() => {
      if (gameStore.winningPaths.length > 0) {
        gameStore.setPhase('showingPaylines');
        setTimeout(() => gameStore.setPhase('showingWinners'), 1500);
        setTimeout(() => gameStore.setPhase('showingWinnings'), 3000);
        setTimeout(() => {
          gameStore.resetWinningPaths();
          gameStore.setPhase('idle');
        }, 6000);
      } else {
        gameStore.setPhase('idle');
      }
    }, 1000);
  } catch (e: any) {
    alert(e.message);
  }
}
</script>
