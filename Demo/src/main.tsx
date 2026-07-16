import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    void window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js')
    })
  } else {
    // Avoid stale PWA caches/sw in dev causing mixed module runtime and hook errors.
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      void Promise.all(registrations.map((registration) => registration.unregister()))
    })

    if ('caches' in window) {
      void caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
