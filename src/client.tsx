/// <reference types="vite/client" />
import './src/styles.css';

import { start } from '@tanstack/react-start/client';
import { getRouter } from './src/router';
import { startInstance } from './src/start';

async function mount() {
  const router = await getRouter();
  const config = await startInstance.getOptions();
  // start() mounts the TanStack Start client into the DOM. It expects the router and config
  start({ router, config, element: document.getElementById('root')! });
}

mount().catch((e) => console.error('Client mount failed', e));
