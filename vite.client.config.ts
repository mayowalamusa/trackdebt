import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Client-only static build for Capacitor
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), react(), tsconfigPaths()],
  resolve: {
    alias: {
      // TanStack Start's createServerFn unconditionally imports Node's
      // AsyncLocalStorage (via @tanstack/start-storage-context), which
      // crashes Capacitor's Android WebView on load. This swaps in a
      // fetch-based stand-in with the same input/output contract, used
      // only for this build — src/lib/reminders.functions.ts and the
      // route that calls it are both untouched.
      '@/lib/reminders.functions': path.resolve(
        __dirname,
        'src/lib/reminders.functions.capacitor.ts',
      ),
    },
  },
  build: {
    outDir: 'dist/capacitor',
    emptyOutDir: true,
  },
});
