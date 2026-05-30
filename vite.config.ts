import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/client'),
  build: {
    outDir: resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@server': resolve(__dirname, 'src/server'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@client': resolve(__dirname, 'src/client'),
    },
  },
});
