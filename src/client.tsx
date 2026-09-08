/// <reference types="vite/client" />
import './styles.css';

import React, { startTransition } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { StartClient } from '@tanstack/react-start/client';
import { getRouter } from './router';

function mount() {
  const rootEl = document.getElementById('root');

  // Static / Capacitor builds ship an index.html containing <div id="root">,
  // so they mount a plain client-side router there.
  if (rootEl) {
    createRoot(rootEl).render(
      <React.StrictMode>
        <RouterProvider router={getRouter()} />
      </React.StrictMode>,
    );
    return;
  }

  // Server-rendered web build: hydrate the streamed document.
  startTransition(() => {
    hydrateRoot(
      document,
      <React.StrictMode>
        <StartClient />
      </React.StrictMode>,
    );
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
