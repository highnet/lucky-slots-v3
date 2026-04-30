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
import { Symbol, SYMBOL_EMOJIS } from '@lucky-slots/engine';

const props = defineProps<{
  row: number;
  col: number;
  symbol: Symbol;
}>();

const emoji = computed(() => SYMBOL_EMOJIS[props.symbol] ?? '❓');

const styleObject = computed(() => ({
  left: `${screenX.value}px`,
  top: `${screenY.value}px`,
  transform: 'translate(-50%, -50%)',
  fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
}));

// Map 3D grid position to screen coordinates roughly
const screenX = computed(() => {
  const canvasWidth = window.innerWidth;
  const centerX = canvasWidth / 2;
  const offset = (props.col - 2) * 120;
  return centerX + offset;
});

const screenY = computed(() => {
  const canvasHeight = window.innerHeight;
  const centerY = canvasHeight / 2;
  const offset = (props.row - 1.5) * 120;
  return centerY + offset;
});
</script>
