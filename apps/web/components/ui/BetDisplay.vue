<template>
  <div class="bg-slate-800/80 backdrop-blur-sm px-6 py-3 rounded-xl border border-slate-700">
    <div class="text-xs text-slate-400 uppercase tracking-wider">Bet</div>
    <div class="text-2xl font-bold text-amber-400">
      ${{ authStore.user?.currentBet?.toFixed(2) ?? gameStore.bet.toFixed(2) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useGameStore } from '~/stores/game';

const authStore = useAuthStore();
const gameStore = useGameStore();
</script>
