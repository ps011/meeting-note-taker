const prasheelUi = require('@prasheel/ui/tailwind')

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [prasheelUi],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './node_modules/@prasheel/ui/dist/**/*.{js,mjs}',
  ],
}
