import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  // 1. Aseguramos que jspdf y autotable se precarguen (opcional, pero recomendado)
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable'] 
  },
  // 2. FORZAMOS EL COMPORTAMIENTO DE CARGA GLOBAL
  build: {
    // Definimos la configuración para Rollup (el bundler de Vite en build)
    rollupOptions: {
      // Le decimos a Rollup que "jspdf" es una dependencia externa...
      external: ['jspdf'], 
      output: {
        // ... y que su contenido se encuentra en la variable global 'jsPDF'.
        globals: {
          jspdf: 'jsPDF' 
        }
      }
    }
  }
})