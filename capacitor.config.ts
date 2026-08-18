import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trackdebt.app',
  appName: 'Track Debt',
  webDir: 'dist/capacitor',
  android: {
    captureInput: true,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
};

export default config;
