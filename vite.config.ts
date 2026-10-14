import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages sirve el juego en /F1Sim/; Firebase Hosting, en la raíz (BASE_PATH=/).
  base: process.env.BASE_PATH ?? '/F1Sim/',
  server: {
    port: 3000,
    open: true
  }
})