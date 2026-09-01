import { useEffect, useState, type ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../lib/api'
import { isAuthenticated } from '../lib/auth'

type Status = 'loading' | 'allowed' | 'denied'

export default function RequireAdmin({ children }: { children: ReactElement }) {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!isAuthenticated()) {
      setStatus('denied')
      return
    }
    let active = true
    api
      .get<{ is_superuser: boolean }>('/auth/me/')
      .then(({ data }) => {
        if (active) setStatus(data.is_superuser ? 'allowed' : 'denied')
      })
      .catch(() => {
        if (active) setStatus('denied')
      })
    return () => {
      active = false
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="admin-loading">
        <span className="admin-loading-spinner" />
        <p>Verifying admin access...</p>
      </div>
    )
  }

  if (status === 'denied') return <Navigate to="/dashboard" replace />
  return children
}