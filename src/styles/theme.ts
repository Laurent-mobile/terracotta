// src/styles/theme.ts
// Identité "Terra Cotta" : terracotta (argile), crème, vert olive, or
export const THEME = {
  colors: {
    primary: '#C1440E',      // Terracotta (votre marque)
    primaryDark: '#8B2E08',
    primaryLight: '#F5A623',
    accent: '#2D6A4F',       // Vert olive (fraîcheur)
    gold: '#D4A017',         // Or (premium)
    cream: '#FDF6EC',        // Fond crème
    dark: '#1A1A1A',
    text: '#2D2D2D',
    textMuted: '#8A8A8A',
    success: '#2D6A4F',
    warning: '#F5A623',
    danger: '#C1440E',
  },
  radius: { sm: '8px', md: '14px', lg: '20px', xl: '28px', full: '9999px' },
  shadow: {
    soft: '0 2px 12px rgba(193, 68, 14, 0.08)',
    card: '0 4px 20px rgba(0, 0, 0, 0.06)',
    lifted: '0 12px 32px rgba(193, 68, 14, 0.15)',
  },
  gradient: {
    brand: 'linear-gradient(135deg, #C1440E 0%, #F5A623 100%)',
    dark: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)',
    glass: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)',
  }
};
