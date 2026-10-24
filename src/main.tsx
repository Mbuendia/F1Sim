import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

// [V1] Auditoría de la interfaz desde la consola (`__uiAudit()`), solo en desarrollo.
if (import.meta.env.DEV) import('./dev/uiAudit')

// [N10] Medidor de consumo de Firebase para la prueba entre redes (`?medir`, también en la versión publicada).
if (new URLSearchParams(location.search).has('medir')) {
  const host = document.body.appendChild(document.createElement('div'))
  import('./components/UsageMeter').then(({ UsageMeter }) => ReactDOM.createRoot(host).render(<UsageMeter />))
}

// [G1] Página de revisión de circuitos: solo existe en desarrollo (`?revision=circuitos`).
if (import.meta.env.DEV && new URLSearchParams(location.search).get('revision') === 'circuitos') {
  import('./dev/CircuitReview').then(({ default: CircuitReview }) => root.render(<CircuitReview />))
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('revision') === 'sala') {
  // [N7] Pantallas de sala con datos simulados (`?revision=sala&pantalla=anfitrion|unirse|invitado|equipo`).
  import('./dev/RoomReview').then(({ default: RoomReview }) => root.render(<RoomReview />))
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('revision') === 'radio-eval') {
  // [IA5] Evaluación del modelo de la radio: carga WebLLM al pulsar (`?revision=radio-eval`).
  import('./dev/RadioEval').then(({ default: RadioEval }) => root.render(<RadioEval />))
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('revision') === 'radio') {
  // [IA4] Ajustes de la radio con la tienda falsa en todos sus estados (`?revision=radio`).
  import('./dev/RadioReview').then(({ default: RadioReview }) => root.render(<RadioReview />))
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('revision') === 'respuestas') {
  // [IA9] Muestra del banco de respuestas para marcar las malas (`?revision=respuestas`).
  import('./dev/RepliesReview').then(({ default: RepliesReview }) => root.render(<RepliesReview />))
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('revision') === 'puente') {
  // Puente de Suzuka y sombras con coches colocados en el cruce (`?revision=puente&hora=0&nubes=0`).
  import('./dev/BridgeReview').then(({ default: BridgeReview }) => root.render(<BridgeReview />))
} else {
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  )
}
