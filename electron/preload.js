// electron/preload.js - Version TRÈS SIMPLE et SURE
const { contextBridge } = require('electron');

// API exposée au renderer
contextBridge.exposeInMainWorld('electron', {
  resetInputs: () => {
    setTimeout(() => {
      const inputs = document.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        try {
          input.blur();
          input.disabled = false;
          input.readOnly = false;
        } catch(e) {}
      });
      document.body.focus();
    }, 100);
  }
});

console.log('✅ Preload loaded');
