import type { ReactNode } from 'react'
import { IconOrbit } from './icons'

type AuthLayoutProps = {
  headline: ReactNode
  sub: string
  benefits: string[]
  children: ReactNode
}

export default function AuthLayout({ headline, sub, benefits, children }: AuthLayoutProps) {
  return (
    <main className="au-page">
      <section className="au-brand">
        <span className="au-orbit-glow" aria-hidden="true" />
        <span className="au-orbit-ring r1" aria-hidden="true" />
        <span className="au-orbit-ring r2" aria-hidden="true" />
        <div className="au-brand-inner">
          <div className="au-brand-mark">
            <span className="au-logo"><IconOrbit size={18} /></span>
            <div className="au-brand-name">
              <strong>FocusFlow AI</strong>
              <em>STUDY ORBIT</em>
            </div>
          </div>
          <h1 className="au-headline">{headline}</h1>
          <p className="au-sub">{sub}</p>
          <ul className="au-benefits">
            {benefits.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      </section>
      <section className="au-panel">
        {children}
      </section>
    </main>
  )
}
