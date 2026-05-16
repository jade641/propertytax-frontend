import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './app/routes/AppRoutes'
import { AuthProvider } from './app/context/AuthContext'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('TaxSync root element was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)