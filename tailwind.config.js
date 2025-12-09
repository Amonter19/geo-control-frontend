/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'geo-blue': '#1e3a8a',    // Azul corporativo
        'geo-dark': '#0f172a',    // Texto oscuro
        'geo-orange': '#f97316',  // Detalles naranjas
        'geo-gray': '#64748b',    // Texto secundario
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}