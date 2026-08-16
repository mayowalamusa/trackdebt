/// <reference types="vite/client" />
import './styles.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';

function mount() {
  const router = getRouter();
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.error('[Track Debt] #root element not found — cannot mount app.');
    return;
  }
  createRoot(rootEl).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
