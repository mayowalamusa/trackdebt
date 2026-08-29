import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Client-only static web build for GitHub Pages. GitHub Pages cannot run the
// TanStack Start/Nitro server output produced by vite.config.ts, so the Pages
// workflow builds the browser application directly and deploys dist/web.
export default defineConfig({
  base: '/trackdebt/',
  plugins: [tailwindcss(), react(), tsconfigPaths()],
  resolve: {
    alias: {
      // Static hosting has no TanStack Start server runtime. Reuse the same
      // browser-safe fallback used by Capacitor so AI reminders fail gracefully
      // instead of importing Node-only Start server internals into the client.
      '@/lib/reminders.functions': path.resolve(
        __dirname,
        'src/lib/reminders.functions.capacitor.ts',
      ),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/web'),
    emptyOutDir: true,
  },
});
