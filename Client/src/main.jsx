import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'goey-toast/styles.css'
import App from './App.jsx'
import './styles/responsive.css'
import './styles/data-table.css'
import AppToaster from './components/ui/AppToaster.jsx'
import { initTheme } from './lib/theme.js'

initTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <AppToaster />
  </StrictMode>,
)
