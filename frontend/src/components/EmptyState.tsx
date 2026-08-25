type EmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  actionTo?: string
  onAction?: () => void
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="empty-state-card">
      <div className="empty-state-orbit" aria-hidden="true">
        <span />
        <span />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
