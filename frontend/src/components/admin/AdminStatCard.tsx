import type { ReactNode } from 'react'

type AdminStatCardProps = {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'green' | 'amber' | 'rose' | 'violet' | 'cyan' | 'mint'
}

export default function AdminStatCard({ label, value, hint, tone = 'default' }: AdminStatCardProps) {
  return (
    <div className={`ad-stat ad-stat-${tone}`}>
      <span className="ad-stat-label">{label}</span>
      <strong className="ad-stat-value">{value}</strong>
      {hint ? <span className="ad-stat-hint">{hint}</span> : null}
    </div>
  )
}