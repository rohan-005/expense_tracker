/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tangerine: '#FF7A1A',
        charcoal: '#1F1F1F',
        surfaceLight: '#F4F4F4',
        surfaceDark: '#E8E8E8',
      },
    },
  },
  plugins: [],
}
