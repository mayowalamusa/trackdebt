/// <reference types="vite/client" />
import './styles.css';

import React, { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';

function mount() {
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
