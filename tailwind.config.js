/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#120d09', 900: '#1a130d', 800: '#241a12', 700: '#33251a' },
        gold: { 200: '#f3dfa6', 300: '#e6c473', 400: '#d4a548', 500: '#b8893a', 600: '#8f6a2a' },
        laterite: { 300: '#d98a62', 400: '#c0683f', 500: '#a4502d', 700: '#6b301a' },
        sand: { 50: '#fbf5e6', 100: '#f6e7c1', 200: '#ecd69b' },
        river: { 400: '#6fb4d8', 500: '#4a9bc4' }
      },
      fontFamily: {
        display: ['"Noto Serif Thai"', 'Georgia', 'serif'],
        sans: ['"Prompt"', '"Sarabun"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 60px -10px rgba(212,165,72,.45)',
        deep: '0 30px 60px -20px rgba(0,0,0,.65)'
      },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        spin3d: { to: { transform: 'rotateY(360deg)' } },
        shimmer: { to: { backgroundPosition: '200% center' } }
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        shimmer: 'shimmer 6s linear infinite'
      }
    }
  },
  plugins: []
};
