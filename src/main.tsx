import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

const container = document.getElementById('root')

if (container) {
  try {
    createRoot(container).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    container.textContent = `Pipeline Flux could not mount. ${message}`
    container.setAttribute(
      'style',
      'padding:2rem;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#f5a524',
    )
    console.error('Pipeline Flux could not mount:', error)
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/'
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // offline support is a bonus; never let registration break the app
    })
  })
}
