import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trackdebt.app',
  appName: 'Track Debt',
  webDir: 'dist/capacitor',
  android: {
    initialFocus: true,
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
  },
};

export default config;
