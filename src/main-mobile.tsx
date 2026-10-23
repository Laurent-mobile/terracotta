// src/main-mobile.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Configuration mobile
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Fonction d'initialisation mobile
const initMobile = async () => {
    if (Capacitor.isNativePlatform()) {
        // Cacher le splash screen après le chargement
        await SplashScreen.hide();

        // Configurer la barre de statut
        await StatusBar.setStyle({ style: 'dark' });
        await StatusBar.setBackgroundColor({ color: '#ffffff' });

        console.log('📱 Application mobile initialisée');
    }
};

// Démarrer l'application
const startApp = async () => {
    await initMobile();

    const root = document.getElementById('root');
    if (root) {
        createRoot(root).render(
            <StrictMode>
                <App />
            </StrictMode>
        );
    }
};

startApp();
