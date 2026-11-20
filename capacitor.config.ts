/**
 * Capacitor configuration for packaging Mizan as a hardened, signed Android app (APK / AAB).
 * Used automatically by `scripts/build-android.sh` and `.github/workflows/android-release.yml`.
 */
const isProduction = process.env.NODE_ENV !== 'development';

const config = {
  appId: 'ir.mizan.ledger',
  appName: 'میزان',
  webDir: 'dist',
  loggingBehavior: isProduction ? 'none' : 'debug',
  server: {
    androidScheme: 'https',
    cleartext: false,
    hostname: 'mizan.local',
  },
  android: {
    backgroundColor: '#FAF6F0',
    allowMixedContent: false,
    webContentsDebuggingEnabled: !isProduction,
    captureInput: true,
    useLegacyBridge: false,
  },
};

export default config;
