import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Navigation from './components/Navigation'
import AppRoutes from './routes'

export default function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') ?? 'dark'
    document.documentElement.dataset.theme = savedTheme
  }, [])

  return (
    <BrowserRouter>
      <Navigation />
      <AppRoutes />
      <ToastContainer position="top-right" theme="dark" />
    </BrowserRouter>
  )
}
