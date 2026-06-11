// file: vite.config.ts
// description: Vite build configuration for the Titanic Iceberg Run static game build
// reference: package.json, index.html

import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
});
