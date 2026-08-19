import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trackdebt.app',
  appName: 'Track Debt',
  webDir: 'dist/capacitor',
  android: {
    captureInput: false,
  },
  plugins: {
    Keyboard: {
      resize: 'native',
      style: 'dark',
    },
  },
};

export default config;
