import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { IconBot } from './icons'

const PRODUCT_LINKS = [
  ['Dashboard', '/dashboard'],
  ['Focus Mode', '/focus'],
  ['FLOX AI', '/ai-tutor'],
  ['Quiz', '/quiz'],
  ['Progress', '/progress'],
] as const

const SUPPORT_LINKS = [
  ['Help & Support', '/help'],
  ['Privacy Policy', '/privacy'],
  ['Terms of Service', '/terms'],
] as const

const COLUMNS = [
  { title: 'Product', links: PRODUCT_LINKS },
  { title: 'Support', links: SUPPORT_LINKS },
] as const

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-brand">
          <Link className="app-footer-logo" to="/">
            <span className="app-footer-mark"><IconBot size={16} /></span>
            <strong>FocusFlow AI</strong>
          </Link>
          <p>Your intelligent study workspace.</p>
        </div>

        {COLUMNS.map((col) => (
          <details className="app-footer-col" key={col.title} open>
            <summary>{col.title}</summary>
            <div className="app-footer-links">
              {col.links.map(([label, to]) => (
                <Fragment key={to}>
                  <Link to={to}>{label}</Link>
                </Fragment>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="app-footer-bottom">
        <span>&copy; {new Date().getFullYear()} FocusFlow AI</span>
        <span>Made for learners</span>
      </div>
    </footer>
  )
}