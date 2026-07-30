import { useEffect } from 'react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Navigation from './components/Navigation'
import { isAuthenticated } from './lib/auth'
import { applyTheme, getTheme } from './lib/theme'
import AppRoutes from './routes'

function AppFrame() {
  const location = useLocation()
  const authed = isAuthenticated()

  return (
    <>
      <Navigation />
      <main className={authed ? 'app-main app-main-with-sidebar' : 'app-main app-main-public'} key={location.pathname}>
        <AppRoutes />
      </main>
      <ToastContainer position="top-right" theme="dark" />
    </>
  )
}

export default function App() {
  useEffect(() => {
    applyTheme(getTheme())
  }, [])

  return (
    <BrowserRouter>
      <AppFrame />
    </BrowserRouter>
  )
}
