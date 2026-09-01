import type { ReactNode } from 'react'

export type TOCItem = { id: string; n: number; label: string }

/** Table of contents for legal documents. */
export function LegalToc({ items }: { items: TOCItem[] }) {
  return (
    <nav className="legal-toc" aria-label="Contents">
      <h3>Contents</h3>
      <ol>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>
              <span className="legal-toc-num">{item.n}.</span>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** One numbered legal section. */
export function LegalSection({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section className="legal-section" id={id}>
      <h2>
        <span className="legal-num">{n}.</span> {title}
      </h2>
      <div className="legal-text">{children}</div>
    </section>
  )
}

/** Bulleted list styled for legal prose. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="legal-list">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}