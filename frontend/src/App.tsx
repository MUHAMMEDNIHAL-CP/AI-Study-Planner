import { useEffect } from 'react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import BottomNav from './components/BottomNav'
import FloatingBot from './components/FloatingBot'
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
      {authed && <FloatingBot />}
      {authed && <BottomNav />}
      <ToastContainer
        position="top-right"
        theme="dark"
        autoClose={2500}
        hideProgressBar
        closeOnClick
        pauseOnHover={false}
        newestOnTop
        limit={3}
      />
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
