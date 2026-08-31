/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf4ff',
          100: '#fae8ff',
          200: '#f3d0fe',
          300: '#e8a9fd',
          400: '#d473fa',
          500: '#be4bf4',
          600: '#a02ed6',
          700: '#8423b3',
          800: '#6e2093',
          900: '#5c1c78',
          950: '#3d0a54',
        },
        rose: {
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        surface: {
          DEFAULT: '#0f0a1a',
          card: '#1a1228',
          elevated: '#231b35',
          border: '#2e2240',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #be4bf4 0%, #f43f5e 100%)',
        'gradient-dark': 'linear-gradient(180deg, #1a1228 0%, #0f0a1a 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(190,75,244,0.1) 0%, rgba(244,63,94,0.05) 100%)',
      },
      boxShadow: {
        brand: '0 4px 32px rgba(190,75,244,0.25)',
        card: '0 2px 16px rgba(0,0,0,0.4)',
        glow: '0 0 20px rgba(190,75,244,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideIn: { from: { transform: 'translateX(-10px)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        slideUp: { from: { transform: 'translateY(20px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
      },
    },
  },
  plugins: [],
};
