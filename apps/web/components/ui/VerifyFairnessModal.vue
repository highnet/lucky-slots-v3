<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      @click.self="close"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <!-- Modal -->
      <div class="relative bg-slate-800 rounded-2xl border border-slate-600 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <span class="text-xl">🔐</span>
            <h3 class="font-bold text-white">Verify Fairness</h3>
          </div>
          <button
            @click="close"
            class="text-slate-400 hover:text-white transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-4">
          <!-- Loading -->
          <div v-if="loading" class="text-center py-8 text-slate-400">
            <div class="animate-spin w-8 h-8 border-2 border-slate-600 border-t-blue-500 rounded-full mx-auto mb-3" />
            Verifying spin...
          </div>

          <!-- Error -->
          <div v-else-if="error" class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            {{ error }}
          </div>

          <!-- Result -->
          <div v-else-if="result" class="space-y-4">
            <!-- Match Badge -->
            <div
              class="flex items-center gap-3 p-4 rounded-xl border"
              :class="result.match
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'"
            >
              <span class="text-2xl">{{ result.match ? '✅' : '❌' }}</span>
              <div>
                <div class="font-bold" :class="result.match ? 'text-emerald-400' : 'text-red-400'">
                  {{ result.match ? 'VERIFIED FAIR' : 'VERIFICATION FAILED' }}
                </div>
                <div class="text-xs text-slate-400">
                  {{ result.match
                    ? 'The recomputed grid matches the original outcome exactly.'
                    : 'The recomputed grid does NOT match. This should never happen.' }}
                </div>
              </div>
            </div>

            <!-- Seeds -->
            <div class="bg-slate-900/50 rounded-xl p-4 space-y-3">
              <h4 class="font-semibold text-sm text-slate-300 uppercase tracking-wider">Seeds</h4>

              <div class="space-y-2">
                <div>
                  <div class="text-xs text-slate-500 mb-1">Server Seed (revealed after spin)</div>
                  <div class="font-mono text-xs bg-slate-800 rounded px-3 py-2 break-all text-slate-300">
                    {{ result.serverSeed }}
                  </div>
                </div>

                <div>
                  <div class="text-xs text-slate-500 mb-1">Server Hash (committed before spin)</div>
                  <div class="font-mono text-xs bg-slate-800 rounded px-3 py-2 break-all text-slate-300">
                    {{ result.serverHash }}
                  </div>
                </div>

                <div>
                  <div class="text-xs text-slate-500 mb-1">Client Seed (fixed per user)</div>
                  <div class="font-mono text-xs bg-slate-800 rounded px-3 py-2 break-all text-slate-300">
                    {{ result.clientSeed }}
                  </div>
                </div>

                <div class="flex gap-4">
                  <div class="flex-1">
                    <div class="text-xs text-slate-500 mb-1">Nonce</div>
                    <div class="font-mono text-sm bg-slate-800 rounded px-3 py-2 text-slate-300">
                      {{ result.nonce }}
                    </div>
                  </div>
                  <div class="flex-1">
                    <div class="text-xs text-slate-500 mb-1">Spin ID</div>
                    <div class="font-mono text-sm bg-slate-800 rounded px-3 py-2 text-slate-300 truncate">
                      {{ result.spinId }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Recomputed Grid -->
            <div v-if="result.recomputedGrid.length > 0">
              <h4 class="font-semibold text-sm text-slate-300 uppercase tracking-wider mb-2">Recomputed Grid</h4>
              <div
                class="inline-grid gap-1 p-3 bg-slate-900/50 rounded-xl"
                :style="gridStyle"
              >
                <div
                  v-for="(cell, idx) in flattenedGrid"
                  :key="idx"
                  class="w-8 h-8 sm:w-10 sm:h-10 rounded flex items-center justify-center text-lg"
                  :class="cell.isWin ? 'bg-amber-500/20 border border-amber-400/40' : 'bg-slate-800'"
                >
                  {{ cell.emoji }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-700 flex justify-end">
          <button
            @click="close"
            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { GRAPHQL_EMOJIS } from '@lucky-slots/engine';

interface SpinEntry {
  id: string;
  symbols: string[][];
  winningPaths: {
    symbol: string;
    size: number;
    coordinates: { row: number; col: number }[];
  }[];
}

const props = defineProps<{
  modelValue: boolean;
  entry: SpinEntry | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const { verify } = useVerifySpin();

interface VerificationResult {
  match: boolean;
  serverSeed: string;
  serverHash: string;
  clientSeed: string;
  nonce: number;
  spinId: string;
  recomputedGrid: string[][];
}

const loading = ref(false);
const error = ref('');
const result = ref<VerificationResult | null>(null);

function close() {
  emit('update:modelValue', false);
}

const gridStyle = computed(() => {
  const cols = result.value?.recomputedGrid[0]?.length ?? props.entry?.symbols[0]?.length ?? 3;
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  };
});

const flattenedGrid = computed(() => {
  if (!result.value?.recomputedGrid.length) return [];
  const grid = result.value.recomputedGrid;
  const winCells = new Set<string>();
  for (const wp of props.entry?.winningPaths ?? []) {
    for (const c of wp.coordinates) {
      winCells.add(`${c.row},${c.col}`);
    }
  }
  const cells: { emoji: string; isWin: boolean }[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      cells.push({
        emoji: GRAPHQL_EMOJIS[grid[row][col]] ?? '❓',
        isWin: winCells.has(`${row},${col}`),
      });
    }
  }
  return cells;
});

watch(() => props.modelValue, async (isOpen) => {
  if (isOpen && props.entry) {
    loading.value = true;
    error.value = '';
    result.value = null;
    try {
      result.value = await verify(props.entry.id);
    } catch (e: any) {
      error.value = e.message ?? 'Verification failed';
    } finally {
      loading.value = false;
    }
  }
});
</script>
