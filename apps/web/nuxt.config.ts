import type { NuxtConfig } from 'nuxt/schema';

const config: NuxtConfig = {
  compatibilityDate: '2026-04-30',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  components: [
    { path: '~/components', pathPrefix: false },
  ],
  typescript: {
    tsConfig: {
      extends: '@lucky-slots/ts-config/nuxt.json',
    },
  },
  build: {
    transpile: ['@lucky-slots/engine', '@lucky-slots/state-machine'],
  },
  vite: {
    optimizeDeps: {
      include: ['three'],
    },
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
};

export default defineNuxtConfig(config) as NuxtConfig;
