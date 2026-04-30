<template>
  <div class="bg-slate-800/80 backdrop-blur-sm px-6 py-3 rounded-xl border border-slate-700">
    <div class="text-xs text-slate-400 uppercase tracking-wider">Balance</div>
    <div class="text-2xl font-bold text-emerald-400">
      ${{ authStore.user?.balance?.toFixed(2) ?? gameStore.balance.toFixed(2) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useGameStore } from '~/stores/game';

const authStore = useAuthStore();
const gameStore = useGameStore();
</script>
