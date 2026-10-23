// src/hooks/useModalReset.ts
import { useEffect, useRef } from 'react';

export function useModalReset(showModal: boolean) {
  const previousShowState = useRef(showModal);
  
  useEffect(() => {
    if (previousShowState.current === true && showModal === false) {
      console.log('🔧 Modal fermé, réactivation forcée des champs...');
      
      // Délai plus long pour Electron
      setTimeout(() => {
        // 1. Réactiver tous les inputs
        const inputs = document.querySelectorAll('input, textarea, select, button');
        inputs.forEach(input => {
          if (input instanceof HTMLElement) {
            input.blur();
            if ('disabled' in input) (input as HTMLInputElement).disabled = false;
            if ('readOnly' in input) (input as HTMLInputElement).readOnly = false;
          }
        });
        
        // 2. FORCER UN REFLOW COMPLET (simule l'ouverture des DevTools)
        const root = document.getElementById('root');
        if (root) {
          root.style.display = 'none';
          root.offsetHeight; // Force reflow
          root.style.display = '';
        }
        
        // 3. Forcer le focus sur le body puis sur le premier champ
        document.body.focus();
        
        // 4. Déclencher un événement de redimensionnement
        window.dispatchEvent(new Event('resize'));
        
        // 5. Utiliser la fonction Electron si disponible
        if ((window as any).electron?.resetInputs) {
          (window as any).electron.resetInputs();
        }
        
        console.log('✅ Réactivation complète terminée');
        
      }, 150); // Délai plus long
    }
    
    previousShowState.current = showModal;
  }, [showModal]);
}
