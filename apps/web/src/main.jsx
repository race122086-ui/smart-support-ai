import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../src/style.css'
import './styles/app.css'
import { App } from './app/App.jsx'

createRoot(document.querySelector('#app')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
