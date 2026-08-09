/// <reference types="vite/client" />
import './styles.css';

import React from 'react';
import { hydrateStart, StartClient } from '@tanstack/react-start-client';
import { getRouter } from './router';
import { startInstance } from './start';

async function mount() {
  const router = await getRouter();
  const config = await startInstance.getOptions();
  hydrateStart(
    <StartClient router={router} config={config} element={document.getElementById('root')!} />,
  );
}

mount().catch((e) => console.error('Client mount failed', e));
