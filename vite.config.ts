import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
// [OF1] Manifiesto de instalación y service worker (sw.js) con las listas de lo que se guarda para jugar sin red.
import { offlinePlugin } from './scripts/vite-offline.mjs'

// [UX3] Número de versión del juego (lo enseña Ajustes; siete toques encienden el modo desarrollador).
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlinePlugin()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // GitHub Pages sirve el juego en /F1Sim/; Firebase Hosting, en la raíz (BASE_PATH=/).
  base: process.env.BASE_PATH ?? '/F1Sim/',
  // [CR6] Los datos de OpenStreetMap de cada circuito (1 MB entre todos) en su propio trozo, para que el de la escena 3D
  // no pase de 1 MB (OF1.2). Se siguen cargando todos con la escena; solo cambia cómo se parten.
  build: {
    rollupOptions: {
      output: {
        manualChunks: id => { const m = id.match(/data[\\/]osmScenery[\\/]([\w-]+)\.json/); return m ? `osm-${m[1]}` : undefined; },
      },
    },
  },
  server: {
    port: 3000,
    open: true
  }
})