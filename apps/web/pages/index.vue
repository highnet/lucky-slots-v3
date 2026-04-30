<template>
  <div class="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
    <!-- Auth prompt -->
    <div v-if="!authStore.isAuthenticated" class="text-center">
      <h1 class="text-4xl font-bold mb-4">Lucky Slots</h1>
      <p class="text-slate-400 mb-8">Please log in to play</p>
      <NuxtLink
        to="/login"
        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
      >
        Login / Register
      </NuxtLink>
    </div>

    <div v-else class="w-full max-w-5xl flex flex-col lg:flex-row gap-6">
      <!-- Main game area -->
      <div class="flex-1">
        <!-- Header -->
        <div class="flex justify-between items-center mb-6">
          <div class="bg-slate-800 px-6 py-3 rounded-xl border border-slate-700">
            <div class="text-xs text-slate-400 uppercase tracking-wider">Balance</div>
            <div class="text-2xl font-bold text-emerald-400">${{ displayBalance }}</div>
          </div>
          <div class="bg-slate-800 px-6 py-3 rounded-xl border border-slate-700">
            <div class="text-xs text-slate-400 uppercase tracking-wider">Bet</div>
            <div class="text-2xl font-bold text-amber-400">${{ displayBet }}</div>
          </div>
        </div>

        <!-- Slot Grid -->
        <div class="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-6">
          <div class="flex justify-center gap-2 sm:gap-3">
            <Reel
              v-for="col in 5"
              :key="col - 1"
              :symbols="reelSymbols(col - 1)"
              :is-spinning="reelSpinning[col - 1]"
              :is-winner="reelWinnerFlags(col - 1)"
            />
          </div>
        </div>

        <!-- Winnings display -->
        <div class="text-center mb-6 h-12">
          <div v-if="showingWinnings && lastResult && lastResult.winnings > 0" class="text-2xl font-bold text-emerald-400 animate-bounce">
            You won ${{ lastResult.winnings.toFixed(2) }}! <span class="text-lg text-emerald-500/70">(x{{ lastResult.multiplier }})</span>
          </div>
          <div v-else-if="!anyReelSpinning && lastResult && lastResult.winnings === 0" class="text-slate-400">
            No win this spin
          </div>
        </div>

        <!-- Controls -->
        <div class="flex justify-center gap-4">
          <button
            @click="handleCycleBet"
            :disabled="anyReelSpinning"
            class="px-6 py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold shadow-lg transition-all active:scale-95"
          >
            Change Bet
          </button>
          <button
            @click="handleSpin"
            :disabled="anyReelSpinning"
            class="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg shadow-lg shadow-blue-900/50 transition-all active:scale-95"
          >
            {{ anyReelSpinning ? 'Spinning...' : 'SPIN' }}
          </button>
          <button
            @click="handleLogout"
            class="px-6 py-4 bg-red-700 hover:bg-red-600 rounded-xl font-semibold shadow-lg transition-all active:scale-95"
          >
            Logout
          </button>
        </div>
      </div>

      <!-- Sidebar: Spin History -->
      <div class="w-full lg:w-80">
        <SpinHistory :entries="history" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';

const GRAPHQL_EMOJIS: Record<string, string> = {
  TEN: '🔟',
  JACK: '👦',
  QUEEN: '👸',
  KING: '👑',
  ACE: '🅰️',
  WILD: '🃏',
  BONUS: '🎁',
};
const SYMBOL_NAMES = Object.keys(GRAPHQL_EMOJIS);

const authStore = useAuthStore();
const { me, logout } = useAuth();
const { spin, cycleBet } = useGameState();
const { fetchHistory } = useSpinHistory();

const anyReelSpinning = ref(false);
const showingWinnings = ref(false);
const lastResult = ref<any>(null);
const history = ref<any[]>([]);

// Per-reel spinning state: true = still spinning
const reelSpinning = ref<boolean[]>([false, false, false, false, false]);
let spinIntervals: (ReturnType<typeof setInterval> | null)[] = [null, null, null, null, null];
let currentReelSymbols = ref<string[][]>([]);

onMounted(async () => {
  try {
    const user = await me();
    if (!user) {
      await navigateTo('/login');
      return;
    }
    history.value = await fetchHistory(50);
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
  if (reelSpinning.value[col]) {
    return currentReelSymbols.value[col] ?? Array(4).fill('TEN');
  }
  if (lastResult.value?.symbols) {
    return [
      lastResult.value.symbols[0][col],
      lastResult.value.symbols[1][col],
      lastResult.value.symbols[2][col],
      lastResult.value.symbols[3][col],
    ];
  }
  return Array(4).fill('TEN');
}

function reelWinnerFlags(col: number): boolean[] {
  if (!lastResult.value?.winningPaths) return [false, false, false, false];
  const flags = [false, false, false, false];
  for (const wp of lastResult.value.winningPaths) {
    for (const c of wp.coordinates) {
      if (c.col === col) {
        flags[c.row] = true;
      }
    }
  }
  return flags;
}

function startReelSpin(col: number) {
  reelSpinning.value[col] = true;
  // Rapidly cycle random symbols for this reel
  spinIntervals[col] = setInterval(() => {
    const newCol = Array.from({ length: 4 }, () => SYMBOL_NAMES[Math.floor(Math.random() * SYMBOL_NAMES.length)]);
    const next = [...currentReelSymbols.value];
    next[col] = newCol;
    currentReelSymbols.value = next;
  }, 60);
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

  // Start all 5 reels spinning
  for (let col = 0; col < 5; col++) {
    startReelSpin(col);
  }

  try {
    const result = await spin();
    lastResult.value = result;

    // Update auth store balance from server
    if (authStore.user && result.newBalance !== undefined) {
      authStore.user.balance = result.newBalance;
    }

    // Staggered stop: left to right, 250ms apart
    const stopDelay = 250;
    for (let col = 0; col < 5; col++) {
      await new Promise((resolve) => setTimeout(resolve, stopDelay));
      stopReelSpin(col);
    }

    // Small pause after all reels stop before showing win
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Add to history
    history.value.unshift({
      id: result.id ?? Date.now().toString(),
      bet: result.bet,
      winnings: result.winnings,
      multiplier: result.multiplier,
      timestamp: result.timestamp ?? new Date().toISOString(),
    });

    // Show winning paylines + winnings text
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
  } catch (e: any) {
    for (let col = 0; col < 5; col++) {
      stopReelSpin(col);
    }
    anyReelSpinning.value = false;
    if (e.message?.includes('authenticated')) {
      await navigateTo('/login');
    } else {
      alert(e.message);
    }
  }
}

async function handleCycleBet() {
  if (anyReelSpinning.value) return;
  try {
    const result = await cycleBet();
    if (authStore.user) {
      authStore.user.currentBet = parseFloat(result.currentBet);
      authStore.user.balance = parseFloat(result.balance);
    }
  } catch (e: any) {
    alert(e.message);
  }
}

async function handleLogout() {
  await logout();
  await navigateTo('/login');
}
</script>
