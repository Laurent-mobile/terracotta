// src/hooks/useFormReset.ts
import { useEffect, useRef } from 'react';

export function useFormReset(dependencies: any[]) {
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)[]>([]);

  const registerInput = (ref: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => {
    if (ref && !inputRefs.current.includes(ref)) {
      inputRefs.current.push(ref);
    }
  };

  const resetFormState = () => {
    // Forcer le blur sur tous les champs pour débloquer
    inputRefs.current.forEach(ref => {
      if (ref) {
        ref.blur();
        // Force le re-render visuel
        const event = new Event('input', { bubbles: true });
        ref.dispatchEvent(event);
      }
    });
  };

  useEffect(() => {
    resetFormState();
  }, dependencies);

  return { registerInput, resetFormState };
}
