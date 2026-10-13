import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)

// [G1] Página de revisión de circuitos: solo existe en desarrollo (`?revision=circuitos`).
if (import.meta.env.DEV && new URLSearchParams(location.search).get('revision') === 'circuitos') {
  import('./dev/CircuitReview').then(({ default: CircuitReview }) => root.render(<CircuitReview />))
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
