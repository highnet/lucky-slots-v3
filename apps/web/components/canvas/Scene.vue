<template>
  <TresCanvas window-size>
    <TresPerspectiveCamera :position="[0, 0, 12]" :fov="45" />
    <TresAmbientLight :intensity="0.5" />
    <TresDirectionalLight :position="[10, 10, 5]" />
    <SlotMachine />
  </TresCanvas>
</template>
