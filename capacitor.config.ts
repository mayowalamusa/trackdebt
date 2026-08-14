import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trackdebt.app',
  appName: 'Track Debt',
  webDir: 'dist/capacitor',
  plugins: {
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
};

export default config;
