import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { mark } from './utils/perf'
import './index.css'
import App from './App.tsx'

mark('boot_start')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
