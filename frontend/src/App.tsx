import { useEffect } from 'react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import BottomNav from './components/BottomNav'
import FloxLimitDialogs from './components/FloxLimitDialogs'
import FloatingBot from './components/FloatingBot'
import Navigation from './components/Navigation'
import ScrollToTop from './components/ScrollToTop'
import { isAuthenticated } from './lib/auth'
import { applyTheme, getTheme } from './lib/theme'
import AppRoutes from './routes'

function AppFrame() {
  const location = useLocation()
  const authed = isAuthenticated()
  const isAdminRoute = location.pathname.startsWith('/admin')

  useEffect(() => {
    const useShell = authed && !isAdminRoute && !location.pathname.startsWith('/login')
    document.body.classList.toggle('app-shell', useShell)
    return () => { document.body.classList.remove('app-shell') }
  }, [authed, isAdminRoute, location.pathname])

  return (
    <>
      <ScrollToTop />
      {!isAdminRoute && <Navigation />}
      <FloxLimitDialogs />
      <main className={authed && !isAdminRoute ? 'app-main app-main-with-sidebar' : 'app-main app-main-public'} key={location.pathname}>
        <AppRoutes />
      </main>
      {authed && !isAdminRoute && <FloatingBot />}
      {authed && !isAdminRoute && <BottomNav />}
      <ToastContainer
        className="flox-toast-container"
        position="bottom-center"
        theme={getTheme() === 'dark' ? 'dark' : 'light'}
        autoClose={2800}
        hideProgressBar
        closeOnClick={false}
        pauseOnHover={false}
        newestOnTop
        limit={3}
        closeButton={false}
        draggable={false}
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
