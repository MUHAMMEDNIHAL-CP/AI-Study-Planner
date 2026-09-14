import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    document
      .querySelectorAll<HTMLElement>('.app-main, .page-shell, .ad-content, main')
      .forEach((el) => {
        el.scrollTop = 0
      })
  }, [pathname])

  return null
}