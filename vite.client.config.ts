import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Client-only static build for Capacitor
export default defineConfig({
  base: './',
  plugins: [react(), tsconfigPaths()],
  build: {
    outDir: 'dist/capacitor',
    emptyOutDir: true,
  },
});
