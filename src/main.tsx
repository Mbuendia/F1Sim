import React from 'react'
import ReactDOM from 'react-dom/client'
// [PF8, LCP] Root pinta la portada al momento y carga el juego (App) aparte.
import Root from './Root'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

// [V1] Auditoría de la interfaz desde la consola (`__uiAudit()`), solo en desarrollo.
if (import.meta.env.DEV) import('./dev/uiAudit')

// [N10] Medidor de consumo de Firebase para la prueba entre redes (`?medir`, también en la versión publicada).
const params = new URLSearchParams(location.search)
if (params.has('medir')) {
  const host = document.body.appendChild(document.createElement('div'))
  import('./components/UsageMeter').then(({ UsageMeter }) => ReactDOM.createRoot(host).render(<UsageMeter />))
}

const renderApp = () => root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Root />
    </AppErrorBoundary>
  </React.StrictMode>,
)

// [UX3] Páginas de revisión (`?revision=…`) y contador de rendimiento (`?rendimiento`): en desarrollo o con el modo
// desarrollador encendido en Ajustes (también en la versión publicada); a un jugador normal, nunca. Todo con import().
// [G1] circuitos · [N7] sala (`&pantalla=anfitrion|unirse|invitado|equipo`) · [IA5] radio-eval · [IA4] radio ·
// [IA9] respuestas · puente (`&hora=0&nubes=0&circuito=…&camara=…`).
const REVIEWS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  circuitos: () => import('./dev/CircuitReview'),
  sala: () => import('./dev/RoomReview'),
  'radio-eval': () => import('./dev/RadioEval'),
  radio: () => import('./dev/RadioReview'),
  respuestas: () => import('./dev/RepliesReview'),
  puente: () => import('./dev/BridgeReview'),
  // [UX15] Prueba a ciegas de voces (Piper frente a Kokoro).
  voces: () => import('./dev/VoiceBlindTest'),
}
const revision = params.get('revision')
const wantsTools = Boolean(revision && REVIEWS[revision]) || params.has('rendimiento')

if (!wantsTools) renderApp()
else {
  import('./dev/devMode').then(({ devToolsAllowed, browserDevStorage }) => {
    const allowed = devToolsAllowed({ dev: import.meta.env.DEV, storage: browserDevStorage() })
    const review = allowed && revision ? REVIEWS[revision] : undefined
    // [PF1] Prueba de rendimiento repetible: `?rendimiento=prueba` (lleva su propio contador).
    const bench = allowed && params.get('rendimiento') === 'prueba'
    if (bench) import('./dev/PerfBenchPage').then(({ default: Page }) => root.render(<Page />))
    else if (review) review().then(({ default: Page }) => root.render(<Page />))
    else renderApp()
    if (allowed && params.has('rendimiento') && !bench) {
      const host = document.body.appendChild(document.createElement('div'))
      import('./dev/PerfOverlay').then(({ PerfOverlay }) => ReactDOM.createRoot(host).render(<PerfOverlay />))
    }
  }).catch(renderApp)
}
