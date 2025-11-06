import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.receiptshield.app',
  appName: 'ReceiptShield',
  webDir: 'out',
  server: {
    // Point to your Next.js server for development
    // The app will load from this URL, enabling API routes to work
    url: 'http://localhost:9003',
    cleartext: true
    
    // For production, uncomment and update:
    // url: 'https://your-production-url.com',
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
