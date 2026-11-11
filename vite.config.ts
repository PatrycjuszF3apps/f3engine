import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demos/html5_launcher',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/locales/pl.json')) {
            return 'locale-pl';
          }
          if (normalized.includes('/locales/en.json')) {
            return 'locale-en';
          }
          if (normalized.includes('/engine/')) {
            return 'engine';
          }
          if (normalized.includes('/degub_bar/')) {
            return 'debug-bar';
          }
          if (normalized.includes('/demos/games/')) {
            return 'demos-games';
          }
          if (normalized.includes('/demos/html5_launcher/')) {
            return 'launcher';
          }
        },
      },
    },
  },
});
