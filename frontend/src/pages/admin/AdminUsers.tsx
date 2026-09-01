import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../lib/adminApi'
import { formatNumber, timeAgo, formatDate } from '../../lib/adminHelpers'
import { getErrorMessage, API_BASE_URL } from '../../lib/api'

type Filter = '' | 'active' | 'suspended' | 'staff' | 'superuser'

function statusPill(user: { is_active: boolean; is_superuser: boolean; is_staff: boolean; last_active: string | null }) {
  if (user.is_superuser) return <span className="ad-pill ad-pill-violet">Superadmin</span>
  if (!user.is_active) return <span className="ad-pill ad-pill-rose">Suspended</span>
  if (user.is_staff) return <span className="ad-pill ad-pill-mint">Staff</span>
  if (user.last_active) {
    const mins = (Date.now() - new Date(user.last_active).getTime()) / 60000
    if (mins < 60) return <span className="ad-pill ad-pill-green">Active</span>
    if (mins < 24 * 60) return <span className="ad-pill ad-pill-amber">Away</span>
  }
  return <span className="ad-pill ad-pill-muted">Dormant</span>
}

function activityLevel(count: number) {
  if (count >= 20) return <span className="ad-pill ad-pill-green">High</span>
  if (count >= 8) return <span className="ad-pill ad-pill-amber">Medium</span>
  if (count >= 1) return <span className="ad-pill ad-pill-muted">Low</span>
  return <span className="ad-pill ad-pill-rose">None</span>
}

export default function AdminUsers() {
  const [results, setResults] = useState<Awaited<ReturnType<typeof adminApi.users>> | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setError('')
    adminApi.users({ search, status: filter, page, page_size: 20, sort: '-date_joined' })
      .then((d) => { if (active) setResults(d) })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
    return () => { active = false }
  }, [search, filter, page])

  const toggleSuspend = useCallback(async (user: { id: number; is_active: boolean; is_superuser: boolean }) => {
    if (user.is_superuser) return
    setBusyId(user.id)
    try {
      const res = await adminApi.suspend(user.id, user.is_active ? 'suspend' : 'unsuspend')
      setResults((cur) => cur ? {
        ...cur,
        results: cur.results.map((u) => u.id === user.id ? { ...u, is_active: res.is_active } : u),
      } : cur)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }, [])

  const totalPages = results ? Math.max(1, Math.ceil(results.total / results.page_size)) : 1

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Users</h1>
          <p>{results ? `${formatNumber(results.total)} total users` : 'Loading users...'}</p>
        </div>
        <div className="ad-page-actions">
          <a
            className="ad-btn"
            href={`${API_BASE_URL}/api/admin/reports/export/?type=users`}
            onClick={() => { void adminApi.logAction('exported_report', undefined, { type: 'users' }) }}
          >
            Export
          </a>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}

      <div className="ad-card">
        <div className="ad-toolbar" style={{ marginBottom: 14 }}>
          <div className="ad-search">
            <span>{'\u2315'}</span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search users..."
            />
          </div>
          <select
            className="ad-btn"
            value={filter}
            onChange={(e) => { setFilter(e.target.value as Filter); setPage(1) }}
            style={{ appearance: 'auto' }}
          >
            <option value="">All users</option>
            <option value="active">Active (7d)</option>
            <option value="suspended">Suspended</option>
            <option value="staff">Staff</option>
            <option value="superuser">Superadmins</option>
          </select>
        </div>

        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Joined</th>
                <th>Last active</th>
                <th>Status</th>
                <th>Activity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(results?.results ?? []).map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="ad-kv">
                      <strong>{u.full_name || u.username}</strong>
                      <small>{u.email}</small>
                    </div>
                  </td>
                  <td>{formatDate(u.date_joined)}</td>
                  <td>{timeAgo(u.last_active)}</td>
                  <td>{statusPill(u)}</td>
                  <td>{activityLevel(u.subject_count + u.task_count + u.quiz_count + u.note_count + u.focus_session_count)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Link className="ad-btn" to={`/admin/users/${u.id}`}>View</Link>
                      {!u.is_superuser && (
                        <button
                          className={`ad-btn ${u.is_active ? 'ad-btn-danger' : ''}`}
                          disabled={busyId === u.id}
                          onClick={() => void toggleSuspend(u)}
                          type="button"
                        >
                          {u.is_active ? 'Suspend' : 'Unsuspend'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading(results) && (results?.results.length ?? 0) === 0 && (
                <tr><td colSpan={6}><div className="ad-empty">No users found.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ad-pager" style={{ marginTop: 14 }}>
          <span>Page {results?.page ?? 1} of {totalPages} · {formatNumber(results?.total ?? 0)} users</span>
          <div className="ad-pager-btns">
            <button className="ad-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">Prev</button>
            <button className="ad-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function loading(results: unknown) {
  return results === null
}