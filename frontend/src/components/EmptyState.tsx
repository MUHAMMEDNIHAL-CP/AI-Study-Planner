import { useNavigate } from 'react-router-dom'

type EmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  actionTo?: string
  onAction?: () => void
}

export default function EmptyState({ title, description, actionLabel, actionTo, onAction }: EmptyStateProps) {
  const navigate = useNavigate()

  return (
    <div className="empty-state-card">
      <div className="empty-state-orbit" aria-hidden="true">
        <span />
        <span />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && (
        <button
          className="empty-state-action ghost-action"
          onClick={() => { if (onAction) onAction(); else if (actionTo) navigate(actionTo) }}
          type="button"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
