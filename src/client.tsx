/// <reference types="vite/client" />
import './styles.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';

async function mount() {
  const rootEl = document.getElementById('root');

  // Static/Capacitor builds ship an index.html with <div id="root">, so we
  // mount a plain client-side router there. The TanStack Start server render
  // has no #root element — in that case we hydrate the streamed document.
  if (rootEl) {
    createRoot(rootEl).render(
      <React.StrictMode>
        <RouterProvider router={getRouter()} />
      </React.StrictMode>,
    );
    return;
  }

  console.log('[TD] hydrating start');
  const { hydrateStart } = await import('@tanstack/react-start/client');
  await hydrateStart();
  console.log('[TD] hydrated');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void mount());
} else {
  void mount();
}
