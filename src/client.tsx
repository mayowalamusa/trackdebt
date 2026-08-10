/// <reference types="vite/client" />
import './styles.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';

function mount() {
  const router = getRouter();
  const rootEl = document.getElementById('root')!;
  createRoot(rootEl).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

mount();
