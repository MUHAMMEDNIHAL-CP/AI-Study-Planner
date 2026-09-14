import { useLocation, useNavigate } from 'react-router-dom'

export default function FloatingBot() {
  const location = useLocation()
  const navigate = useNavigate()
  const hidden = location.pathname === '/ai-tutor' || location.pathname.startsWith('/admin')

  if (hidden) return null

  return (
    <button
      className="floating-bot-btn"
      onClick={() => navigate('/ai-tutor')}
      type="button"
      aria-label="Open FLOX AI"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4H8" />
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="M12 11v4" />
        <path d="M12 18h.01" />
      </svg>
    </button>
  )
}