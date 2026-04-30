<template>
  <button
    @click="handleCycle"
    :disabled="gameStore.isSpinning"
    class="px-6 py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold shadow-lg transition-all active:scale-95"
  >
    Change Bet
  </button>
</template>

<script setup lang="ts">
const { cycleBet } = useGameState();
const gameStore = useGameStore();

async function handleCycle() {
  if (gameStore.isSpinning) return;
  try {
    await cycleBet();
  } catch (e: any) {
    alert(e.message);
  }
}
</script>
