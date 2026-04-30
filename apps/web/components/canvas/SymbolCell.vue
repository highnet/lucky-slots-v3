<!-- Positions an emoji symbol on screen to overlay a 3D TresJS grid cell. -->
<template>
  <div
    class="absolute text-4xl select-none pointer-events-none"
    :style="styleObject"
  >
    {{ emoji }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { GRAPHQL_EMOJIS } from '@lucky-slots/engine';

const props = defineProps<{
  row: number;
  col: number;
  symbol: string;
}>();

/** Resolved emoji for the current symbol name. */
const emoji = computed(() => GRAPHQL_EMOJIS[props.symbol] ?? '❓');

/** Absolute positioning style for screen overlay. */
const styleObject = computed(() => ({
  left: `${screenX.value}px`,
  top: `${screenY.value}px`,
  transform: 'translate(-50%, -50%)',
  fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
}));

/** Map 3D grid column to a screen X coordinate (rough heuristic). */
const screenX = computed(() => {
  const canvasWidth = window.innerWidth;
  const centerX = canvasWidth / 2;
  const offset = (props.col - 2) * 120;
  return centerX + offset;
});

/** Map 3D grid row to a screen Y coordinate (rough heuristic). */
const screenY = computed(() => {
  const canvasHeight = window.innerHeight;
  const centerY = canvasHeight / 2;
  const offset = (props.row - 1.5) * 120;
  return centerY + offset;
});
</script>
