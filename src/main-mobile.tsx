import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Configuration mobile Capacitor
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Fonction d'initialisation mobile
const initMobile = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            // 1. Configurer la barre de statut (Style.Dark pour un texte noir sur fond blanc)
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#ffffff' });
            
            // 2. Cacher le splash screen une fois l'app prête
            await SplashScreen.hide();

            console.log('📱 Application mobile initialisée avec succès');
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation mobile:', error);
        }
    }
};

// Démarrer l'application
const startApp = async () => {
    // On initialise d'abord l'environnement mobile, puis on monte React
    await initMobile();

    const rootElement = document.getElementById('root');
    if (rootElement) {
        createRoot(rootElement).render(
            <StrictMode>
                <App />
            </StrictMode>
        );
    } else {
        console.error('❌ Élément #root introuvable dans le DOM. Vérifiez votre index.html');
    }
};

startApp();
