import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.VITE_DEMO === '1') await import('./demo/mock')

// Email links (confirm account, reset password) land with tokens in the address.
// Remember which kind so the home page can send the person to the right place once signed in.
if (/access_token=|error_description=/.test(window.location.hash)) {
  try {
    sessionStorage.setItem('fromLoginLink', /type=recovery/.test(window.location.hash) ? 'recovery' : '1')
  } catch {
    /* storage blocked */
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
