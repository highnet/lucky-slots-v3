<!-- 3D slot machine grid rendered with TresJS. Displays coloured boxes and emoji overlays. -->
<template>
  <TresGroup>
    <TresMesh
      v-for="(cell, idx) in gridCells"
      :key="idx"
      :position="[cell.x, cell.y, 0]"
    >
      <TresBoxGeometry :args="[1.8, 1.8, 0.2]" />
      <TresMeshStandardMaterial :color="cell.color" />
    </TresMesh>
  </TresGroup>
  <!-- Emoji overlay -->
  <SymbolCell
    v-for="(cell, idx) in symbolCells"
    :key="`sym-${idx}`"
    :row="cell.row"
    :col="cell.col"
    :symbol="cell.symbol"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '~/stores/game';

const gameStore = useGameStore();

const gridCells = computed(() => {
  const cells: { x: number; y: number; color: string }[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const isWinner = gameStore.winningPaths.some((p) =>
        p.coordinates.some((c) => c.row === row && c.col === col)
      );
      cells.push({
        x: (col - 2) * 2.2,
        y: -(row - 1.5) * 2.2,
        color: isWinner ? '#fbbf24' : '#1e293b',
      });
    }
  }
  return cells;
});

const symbolCells = computed(() => {
  const symbols = gameStore.lastSpin?.symbols;
  const cells: { row: number; col: number; symbol: string }[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      cells.push({
        row,
        col,
        symbol: symbols ? symbols[row][col] : 'TEN',
      });
    }
  }
  return cells;
});
</script>
