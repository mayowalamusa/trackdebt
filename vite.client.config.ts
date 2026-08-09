import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

// Client-only static build for Capacitor
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), react(), tsconfigPaths()],
  build: {
    outDir: 'dist/capacitor',
    emptyOutDir: true,
  },
});
