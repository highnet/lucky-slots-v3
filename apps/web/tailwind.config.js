/**
 * @fileoverview tailwind.config.js
 *
 * Tailwind CSS configuration for the Lucky Slots Nuxt app.
 *
 * Scans Vue, JS, and TS files across components, layouts, pages,
 * composables, and plugins for class-name extraction.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
