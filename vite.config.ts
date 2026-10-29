import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// [UX3] Número de versión del juego (lo enseña Ajustes; siete toques encienden el modo desarrollador).
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // GitHub Pages sirve el juego en /F1Sim/; Firebase Hosting, en la raíz (BASE_PATH=/).
  base: process.env.BASE_PATH ?? '/F1Sim/',
  server: {
    port: 3000,
    open: true
  }
})