import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber } from '../../lib/adminHelpers'

export default function AdminHealth() {
  const { data, error, loading } = useAdminData(adminApi.health)

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>System Health</h1>
          <p>Service status · response times · platform counts</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Checking system health...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-card">
            <div className="ad-card-title">
              <h3>Overall status</h3>
              <span className={`ad-pill ${data.overall === 'healthy' ? 'ad-pill-green' : data.overall === 'warning' ? 'ad-pill-amber' : 'ad-pill-rose'}`}>
                {data.overall.toUpperCase()}
              </span>
            </div>
            <div className="ad-health-list">
              {Object.entries(data.services).map(([name, svc]) => (
                <div className="ad-health-row" key={name}>
                  <span className="ad-health-name">
                    <i className={svc.status} />
                    {serviceLabel(name)}
                  </span>
                  <span className="ad-health-meta">
                    {svc.provider ? `${svc.provider} · ` : ''}
                    {svc.response_ms != null ? `${svc.response_ms}ms` : ''}
                    {svc.error ? `· ${svc.error}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>Platform data</h3><span>Record counts</span></div>
            <div className="ad-bars">
              {Object.entries(data.counts).map(([k, v]) => (
                <div className="ad-bar-row" key={k}>
                  <span>{countLabel(k)}</span>
                  <div className="ad-bar-track">
                    <i className="ad-bar-fill" style={{ width: `${Math.min(100, Math.round((v / Math.max(...Object.values(data.counts), 1)) * 100))}%` }} />
                  </div>
                  <span className="ad-bar-num">{formatNumber(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function serviceLabel(name: string) {
  return {
    api: 'API',
    database: 'Database',
    authentication: 'Authentication',
    ai_service: 'AI Service',
    notifications: 'Notifications',
  }[name] ?? name
}

function countLabel(k: string) {
  return {
    users: 'Users',
    subjects: 'Subjects',
    tasks: 'Tasks',
    quizzes: 'Quizzes',
    notes: 'Notes',
    focus_sessions: 'Focus sessions',
    ai_conversations: 'AI conversations',
    exams: 'Exams',
  }[k] ?? k
}