import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2022', chunkSizeWarningLimit: 4000, assetsInlineLimit: 0,
    rollupOptions: { output: { assetFileNames: (info) => (info.name && info.name.endsWith('.mjs') ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]') } },
  },
  worker: { format: 'es' },
});
