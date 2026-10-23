// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.terracotta.restaurant',
  appName: 'Terra Cotta',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    // clearTextTraffic: true, // ❌ Cette propriété n'existe pas dans Capacitor 8+
    // Utilisez cette configuration à la place :
    allowNavigation: ['*'],
    // Pour autoriser le HTTP en développement :
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff',
      overlay: false
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  },
  ios: {
    scheme: 'Terra Cotta',
    contentInset: 'automatic',
    allowsLinkPreview: true,
    scrollEnabled: true
  },
  android: {
    // clearTextTraffic est configuré dans android/app/src/main/AndroidManifest.xml
    // Pas dans le fichier capacitor.config.ts
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  }
};

export default config;
