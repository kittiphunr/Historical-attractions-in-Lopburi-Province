/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './assets/js/app.js', './assets/js/data.js', './assets/js/models.js'],
  theme: {
    extend: {
      colors: {
        cream: { 50: 'rgb(var(--cream-50) / <alpha-value>)', 100: 'rgb(var(--cream-100) / <alpha-value>)', 200: 'rgb(var(--cream-200) / <alpha-value>)', 300: 'rgb(var(--cream-300) / <alpha-value>)' },
        snow: { 50: '#fbf7f1', 100: '#f4ece2', 200: '#eadfd1' },
        paper: 'rgb(var(--paper) / <alpha-value>)',
        terra: { 300: '#e59570', 400: '#d9693f', 500: '#c4552f', 600: '#a8431f', 700: '#7f3217' },
        char: { 900: '#201c19', 800: '#2b2623', 700: '#3a332e' },
        ink: { 900: 'rgb(var(--ink-900) / <alpha-value>)', 700: 'rgb(var(--ink-700) / <alpha-value>)', 500: 'rgb(var(--ink-500) / <alpha-value>)', 400: 'rgb(var(--ink-400) / <alpha-value>)' }
      },
      fontFamily: {
        display: ['"Prompt"', '"Sarabun"', 'system-ui', 'sans-serif'],
        sans: ['"Prompt"', '"Sarabun"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        neu: 'var(--shadow-neu)',
        dark: 'var(--shadow-dark)',
        press: 'var(--shadow-press)'
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
