/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './assets/js/app.js', './assets/js/data.js', './assets/js/models.js'],
  theme: {
    extend: {
      colors: {
        cream: { 50: '#fbf7f1', 100: '#f4ece2', 200: '#eadfd1', 300: '#dccdba' },
        terra: { 300: '#e59570', 400: '#d9693f', 500: '#c4552f', 600: '#a8431f', 700: '#7f3217' },
        char: { 900: '#201c19', 800: '#2b2623', 700: '#3a332e' },
        ink: { 900: '#2a2320', 700: '#4a3f38', 500: '#7a6c60', 400: '#9a8c80' }
      },
      fontFamily: {
        display: ['"Prompt"', '"Sarabun"', 'system-ui', 'sans-serif'],
        sans: ['"Prompt"', '"Sarabun"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 22px 40px -22px rgba(120,72,40,.38), 0 2px 0 rgba(255,255,255,.95) inset',
        neu: '7px 7px 18px rgba(135,92,60,.17), -6px -6px 16px rgba(255,255,255,.95)',
        dark: '0 26px 44px -20px rgba(30,20,12,.65)',
        press: 'inset 3px 3px 8px rgba(135,92,60,.18), inset -3px -3px 8px rgba(255,255,255,.9)'
      },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        spinSlow: { to: { transform: 'rotate(360deg)' } }
      },
      animation: { floaty: '5s ease-in-out infinite floaty', spinSlow: 'spinSlow 40s linear infinite' }
    }
  },
  plugins: []
};
