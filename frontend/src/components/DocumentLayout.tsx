import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isAuthenticated } from '../lib/auth'
import { IconBot } from './icons'
import AppFooter from './AppFooter'

type DocumentLayoutProps = {
  eyebrow?: string
  title: string
  subtitle: string
  children: ReactNode
}

/** Shared shell for public-facing document pages (Help, Privacy, Terms).
 *  When signed in the global app sidebar is already present (App.tsx); this
 *  shell only adds a compact top bar for visitors who are not signed in. */
export default function DocumentLayout({ eyebrow, title, subtitle, children }: DocumentLayoutProps) {
  const authed = isAuthenticated()

  return (
    <div className="doc-page">
      <header className="doc-nav">
        <Link className="doc-brand" to={authed ? '/dashboard' : '/'}>
          <span className="doc-brand-mark"><IconBot size={18} /></span>
          <strong>FocusFlow AI</strong>
        </Link>
        <div className="doc-nav-spacer" />
        {authed ? (
          <Link className="doc-nav-cta" to="/dashboard">Back to Dashboard</Link>
        ) : (
          <div className="doc-nav-actions">
            <Link className="doc-nav-link" to="/login">Log in</Link>
            <Link className="doc-nav-cta" to="/register">Start free</Link>
          </div>
        )}
      </header>

      <main className="doc-main">
        <header className="doc-hero">
          {eyebrow && <span className="doc-eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>
        <div className="doc-content">{children}</div>
      </main>

      <AppFooter />
    </div>
  )
}