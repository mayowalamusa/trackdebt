import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trackdebt.app',
  appName: 'Track Debt',
  webDir: 'dist/capacitor',
  plugins: {
    Keyboard: {
      resize: 'none',
      style: 'dark',
    },
  },
};

export default config;
