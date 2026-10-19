import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

// [V1] Auditoría de la interfaz desde la consola (`__uiAudit()`), solo en desarrollo.
if (import.meta.env.DEV) import('./dev/uiAudit')

// [G1] Página de revisión de circuitos: solo existe en desarrollo (`?revision=circuitos`).
if (import.meta.env.DEV && new URLSearchParams(location.search).get('revision') === 'circuitos') {
  import('./dev/CircuitReview').then(({ default: CircuitReview }) => root.render(<CircuitReview />))
} else if (import.meta.env.DEV && new URLSearchParams(location.search).get('revision') === 'sala') {
  // [N7] Pantallas de sala con datos simulados (`?revision=sala&pantalla=anfitrion|unirse|invitado|equipo`).
  import('./dev/RoomReview').then(({ default: RoomReview }) => root.render(<RoomReview />))
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
