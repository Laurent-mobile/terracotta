/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index-mobile.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        terracotta: {
          50: '#fdf4f0',
          100: '#fbe8e0',
          200: '#f7d0c0',
          300: '#f2b19a',
          400: '#ec8b6e',
          500: '#e66b4a',
          600: '#d95034',
          700: '#c1440e',
          800: '#8b2e08',
          900: '#5c1e05',
        },
        cream: {
          50: '#fffdf9',
          100: '#fdf6ec',
          200: '#faecd4',
          300: '#f5dcb0',
        },
        gold: {
          400: '#f5c842',
          500: '#d4a017',
          600: '#b8860b',
        },
        olive: {
          500: '#2d6a4f',
          600: '#1b4332',
          700: '#0d2818',
        },
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'pulse-soft': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'cart-bounce': {
          '0%, 100%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.3)' },
          '60%': { transform: 'scale(0.9)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in-up 0.4s ease-out both',
        'slide-in': 'slide-in-right 0.3s ease-out both',
        'shimmer': 'shimmer 1.4s infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'cart-bounce': 'cart-bounce 0.5s ease',
        'slide-up': 'slide-up 0.3s ease-out both',
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 12px rgba(193, 68, 14, 0.08)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.06)',
        'lifted': '0 12px 32px rgba(193, 68, 14, 0.15)',
        'terracotta': '0 4px 14px rgba(193, 68, 14, 0.25)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #C1440E 0%, #F5A623 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)',
        'gradient-cream': 'linear-gradient(135deg, #FDF6EC 0%, #FAECD4 100%)',
      },
    },
  },
  plugins: [],
};
