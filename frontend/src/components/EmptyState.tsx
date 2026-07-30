import { Link } from 'react-router-dom'

type EmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  actionTo?: string
  onAction?: () => void
}

export default function EmptyState({ title, description, actionLabel, actionTo, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state-card">
      <div className="empty-state-orbit" aria-hidden="true">
        <span />
        <span />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && actionTo ? (
        <Link className="gradient-action empty-state-action" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button className="gradient-action empty-state-action" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
