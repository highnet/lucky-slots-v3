<!-- Main game page: slot grid, controls, balance/bet display, and spin history. -->
<template>
  <div class="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-3 sm:p-4">
    <!-- Auth prompt -->
    <div v-if="!authStore.isAuthenticated" class="text-center px-4">
      <h1 class="text-3xl sm:text-4xl font-bold mb-4">Lucky Slots</h1>
      <p class="text-slate-400 mb-8">Please log in to play</p>
      <NuxtLink
        to="/login"
        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors inline-block"
      >
        Login / Register
      </NuxtLink>
    </div>

    <div v-else class="w-full max-w-6xl flex flex-col lg:flex-row gap-4 sm:gap-6">
      <!-- Main game area -->
      <div class="flex-1 min-w-0">
        <!-- Header -->
        <div class="flex justify-between items-center mb-4 sm:mb-6 gap-2">
          <div class="bg-slate-800 px-4 sm:px-6 py-2 sm:py-3 rounded-xl border border-slate-700 flex-1">
            <div class="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Balance</div>
            <div class="text-xl sm:text-2xl font-bold text-emerald-400">${{ displayBalance }}</div>
          </div>
          <div class="bg-slate-800 px-4 sm:px-6 py-2 sm:py-3 rounded-xl border border-slate-700 flex-1">
            <div class="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider">Bet</div>
            <div class="text-xl sm:text-2xl font-bold text-amber-400">${{ displayBet }}</div>
          </div>
        </div>

        <!-- Slot Grid -->
        <div class="bg-slate-800 rounded-2xl p-3 sm:p-6 border border-slate-700 mb-4 sm:mb-6">
          <div
            class="grid gap-1 sm:gap-1.5 md:gap-2 mx-auto"
            :style="{ gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(0, 1fr))`, maxWidth: 'fit-content' }"
          >
            <Reel
              v-for="col in gridConfig.cols"
              :key="col - 1"
              :symbols="reelSymbols(col - 1)"
              :is-spinning="reelSpinning[col - 1]"
              :is-winner="reelWinnerFlags(col - 1)"
              :grid-cols="gridConfig.cols"
              :grid-rows="gridConfig.rows"
            />
          </div>
        </div>

        <!-- Winnings display -->
        <div class="text-center mb-4 sm:mb-6 h-10 sm:h-12">
          <div v-if="showingWinnings && lastResult && lastResult.winnings > 0" class="text-lg sm:text-2xl font-bold text-emerald-400 animate-bounce">
            You won ${{ lastResult.winnings.toFixed(2) }}! <span class="text-sm sm:text-lg text-emerald-500/70">(x{{ lastResult.multiplier }})</span>
          </div>
          <div v-else-if="!anyReelSpinning && lastResult && lastResult.winnings === 0" class="text-slate-400 text-sm sm:text-base">
            No win this spin
          </div>
        </div>

        <!-- Controls -->
        <div class="flex justify-center gap-2 sm:gap-4">
          <button
            @click="handleCycleBet"
            :disabled="anyReelSpinning"
            class="px-4 sm:px-6 py-3 sm:py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold shadow-lg transition-all active:scale-95 text-sm sm:text-base"
          >
            Change Bet
          </button>
          <button
            @click="handleSpin"
            :disabled="anyReelSpinning"
            class="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-base sm:text-lg shadow-lg shadow-blue-900/50 transition-all active:scale-95 min-w-[120px]"
          >
            {{ anyReelSpinning ? 'Spinning...' : 'SPIN' }}
          </button>
          <button
            @click="handleLogout"
            class="px-4 sm:px-6 py-3 sm:py-4 bg-red-700 hover:bg-red-600 rounded-xl font-semibold shadow-lg transition-all active:scale-95 text-sm sm:text-base"
          >
            Logout
          </button>
        </div>
      </div>

      <!-- Sidebar: Spin History -->
      <div class="w-full lg:w-80 shrink-0">
        <SpinHistory :entries="history" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import type { SpinResult } from '~/stores/game';
import { fetchGridConfig, fetchReelStrips, getReelWindow } from '~/composables/useReelStrips';
import type { GridConfig } from '~/composables/useReelStrips';

const authStore = useAuthStore();
const { me, logout } = useAuth();
const { spin, cycleBet } = useGameState();
const { fetchHistory } = useSpinHistory();

const anyReelSpinning = ref(false);
const showingWinnings = ref(false);
const lastResult = ref<SpinResult | null>(null);
const history = ref<SpinResult[]>([]);
const reelStrips = ref<string[][]>([]);
const gridConfig = ref<GridConfig>({
  rows: 4,
  cols: 5,
  minMatch: 3,
  numSymbols: 7,
  stripSize: 100,
  paylineSymbols: 5,
});

const reelSpinning = ref<boolean[]>([]);
let spinIntervals: (ReturnType<typeof setInterval> | null)[] = [];
const reelOffsets = ref<number[]>([]);

onMounted(async () => {
  try {
    const user = await me();
    if (!user) {
      await navigateTo('/login');
      return;
    }

    // Fetch config and strips from backend in parallel
    const [cfg, strips] = await Promise.all([
      fetchGridConfig(),
      fetchReelStrips(),
      fetchHistory(50),
    ]);

    gridConfig.value = cfg;
    reelStrips.value = strips;
    history.value = await fetchHistory(50);

    // Resize arrays to match config
    reelSpinning.value = Array(cfg.cols).fill(false);
    spinIntervals = Array(cfg.cols).fill(null);
    reelOffsets.value = Array(cfg.cols).fill(0);
  } catch {
    await navigateTo('/login');
  }
});

const displayBalance = computed(() => {
  return (authStore.user?.balance ?? 0).toFixed(2);
});

const displayBet = computed(() => {
  return (authStore.user?.currentBet ?? 0.1).toFixed(2);
});

function reelSymbols(col: number): string[] {
  const rows = gridConfig.value.rows;
  if (reelSpinning.value[col]) {
    return getReelWindow(col, reelOffsets.value[col], reelStrips.value, rows);
  }
  if (lastResult.value?.symbols) {
    const result: string[] = [];
    for (let row = 0; row < rows; row++) {
      result.push(lastResult.value.symbols[row][col]);
    }
    return result;
  }
  return getReelWindow(col, 0, reelStrips.value, rows);
}

function reelWinnerFlags(col: number): boolean[] {
  const flags = Array(gridConfig.value.rows).fill(false);
  if (!lastResult.value?.winningPaths) return flags;
  for (const wp of lastResult.value.winningPaths) {
    for (const c of wp.coordinates) {
      if (c.col === col && c.row >= 0 && c.row < gridConfig.value.rows) {
        flags[c.row] = true;
      }
    }
  }
  return flags;
}

function startReelSpin(col: number) {
  reelSpinning.value[col] = true;
  reelOffsets.value[col] = Math.floor(Math.random() * gridConfig.value.stripSize);
  spinIntervals[col] = setInterval(() => {
    reelOffsets.value[col] = (reelOffsets.value[col] + 3) % gridConfig.value.stripSize;
  }, 40);
}

function stopReelSpin(col: number) {
  if (spinIntervals[col]) {
    clearInterval(spinIntervals[col]);
    spinIntervals[col] = null;
  }
  reelSpinning.value[col] = false;
}

async function handleSpin() {
  if (anyReelSpinning.value) return;
  anyReelSpinning.value = true;
  showingWinnings.value = false;

  for (let col = 0; col < gridConfig.value.cols; col++) {
    startReelSpin(col);
  }

  try {
    const result = await spin();
    lastResult.value = result;

    if (authStore.user && result.newBalance !== undefined) {
      authStore.user.balance = result.newBalance;
    }

    const stopDelay = 250;
    for (let col = 0; col < gridConfig.value.cols; col++) {
      await new Promise((resolve) => setTimeout(resolve, stopDelay));
      stopReelSpin(col);
    }

    await new Promise((resolve) => setTimeout(resolve, 400));

    history.value.push({
      id: result.id ?? Date.now().toString(),
      bet: result.bet,
      winnings: result.winnings,
      multiplier: result.multiplier,
      timestamp: result.timestamp ?? new Date().toISOString(),
      newBalance: result.newBalance,
      symbols: result.symbols ?? [],
      winningPaths: result.winningPaths ?? [],
    });

    if (result.winningPaths?.length > 0) {
      showingWinnings.value = true;
      setTimeout(() => {
        showingWinnings.value = false;
        anyReelSpinning.value = false;
      }, 2500);
    } else {
      setTimeout(() => {
        anyReelSpinning.value = false;
      }, 600);
    }
  } catch (e: unknown) {
    for (let col = 0; col < gridConfig.value.cols; col++) {
      stopReelSpin(col);
    }
    anyReelSpinning.value = false;
    const err = e instanceof Error ? e : new Error(String(e));
    if (err.message.includes('authenticated')) {
      await navigateTo('/login');
    } else {
      alert(err.message);
    }
  }
}

async function handleCycleBet() {
  if (anyReelSpinning.value) return;
  try {
    const result = await cycleBet();
    if (authStore.user) {
      authStore.user.currentBet = parseFloat(String(result.currentBet));
      authStore.user.balance = parseFloat(String(result.balance));
    }
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    alert(err.message);
  }
}

async function handleLogout() {
  await logout();
  await navigateTo('/login');
}
</script>
