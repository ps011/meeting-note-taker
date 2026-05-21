/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      borderRadius: { base: '5px' },
      borderWidth: { '3': '3px' },
      boxShadow: {
        shadow: '4px 4px 0px 0px #000000',
        'shadow-sm': '2px 2px 0px 0px #000000',
      },
      translate: {
        boxShadowX: '4px',
        boxShadowY: '4px',
        reverseBoxShadowX: '-4px',
        reverseBoxShadowY: '-4px',
      },
      colors: {
        main: 'var(--main)',
        'main-foreground': 'var(--main-foreground)',
        border: 'var(--border)',
        foreground: 'var(--foreground)',
        background: 'var(--background)',
        'secondary-background': 'var(--secondary-background)',
        ring: 'var(--ring)',
        'muted-foreground': 'var(--muted-foreground)',
      },
      fontWeight: { base: '500', heading: '700' },
      fontFamily: { sans: ['var(--font-sans)'] },
    },
  },
  plugins: [],
}
