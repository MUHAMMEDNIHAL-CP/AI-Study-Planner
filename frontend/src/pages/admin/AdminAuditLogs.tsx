import { useEffect, useState } from 'react'
import { adminApi } from '../../lib/adminApi'
import { getErrorMessage } from '../../lib/api'

type LogItem = {
  id: number
  admin_username: string
  target_username: string
  action: string
  detail: Record<string, unknown>
  created_at: string
}

export default function AdminAuditLogs() {
  const [rows, setRows] = useState<Array<{
    results: LogItem[]
    total: number
    page: number
  }> | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setError('')
    adminApi.auditLogs({ page, page_size: 40 })
      .then((d) => { if (active) setRows([d]) })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
    return () => { active = false }
  }, [page])

  const data = rows?.[0]
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 40)) : 1

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Audit Log</h1>
          <p>Every sensitive admin action is recorded here</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {!data && !error && <div className="ad-empty">Loading audit logs...</div>}

      {data && (
        <div className="ad-card">
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((log) => (
                  <tr key={log.id}>
                    <td>{formatTime(log.created_at)}</td>
                    <td>{log.admin_username || '—'}</td>
                    <td><span className="ad-pill ad-pill-violet">{actionLabel(log.action)}</span></td>
                    <td>{log.target_username || '—'}</td>
                  </tr>
                ))}
                {data.results.length === 0 && (
                  <tr><td colSpan={4}><div className="ad-empty">No admin actions logged yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ad-pager" style={{ marginTop: 14 }}>
            <span>{data.total} entries · page {data.page} of {totalPages}</span>
            <div className="ad-pager-btns">
              <button className="ad-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">Prev</button>
              <button className="ad-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    suspended_user: 'Suspended user',
    unsuspended_user: 'Unsuspended user',
    generated_report: 'Generated report',
    exported_report: 'Exported report',
    updated_feature: 'Updated feature',
    changed_setting: 'Changed setting',
  }
  return map[action] ?? action.replace(/_/g, ' ')
}