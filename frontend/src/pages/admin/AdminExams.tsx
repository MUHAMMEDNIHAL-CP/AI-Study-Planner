import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber } from '../../lib/adminHelpers'
import AdminStatCard from '../../components/admin/AdminStatCard'

export default function AdminExams() {
  const { data, error, loading } = useAdminData(adminApi.exams)

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Exams</h1>
          <p>Upcoming exams · preparation activity</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading exams...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-stats">
            <AdminStatCard label="Upcoming exams" value={formatNumber(data.upcoming)} hint="From today onward" tone="violet" />
            <AdminStatCard label="Added this week" value={formatNumber(data.added_this_week)} hint="Last 7 days" tone="cyan" />
            <AdminStatCard label="Total exams" value={formatNumber(data.total_exams)} hint="All-time" tone="green" />
            <AdminStatCard label="Avg exams/user" value={`${data.average_exams_per_user}`} hint="Active users" tone="amber" />
          </div>

          <div className="ad-grid">
            <div className="ad-card">
              <div className="ad-card-title"><h3>Exams in the next 7 days</h3><span>By subject</span></div>
              <div className="ad-bars">
                {(data.upcoming_by_subject ?? []).length ? (
                  data.upcoming_by_subject.map((e) => {
                    const pct = Math.round((e.count / Math.max(data.upcoming_by_subject[0].count, 1)) * 100)
                    return (
                      <div className="ad-bar-row" key={e.subject ?? 'Other'}>
                        <span>{e.subject ?? 'Other'}</span>
                        <div className="ad-bar-track">
                          <i className="ad-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="ad-bar-num">{formatNumber(e.count)}</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="ad-empty">No exams in the next 7 days.</div>
                )}
              </div>
            </div>

            <div className="ad-card">
              <div className="ad-card-title"><h3>Exams by priority</h3><span>All-time</span></div>
              <div className="ad-bars">
                {data.priority_breakdown.map((p) => (
                  <div className="ad-bar-row" key={p.priority}>
                    <span>{priorityLabel(p.priority)}</span>
                    <div className="ad-bar-track">
                      <i className={`ad-bar-fill ${p.priority === 'high' ? 'amber' : ''}`} style={{ width: `${Math.round((p.count / Math.max(data.total_exams, 1)) * 100)}%` }} />
                    </div>
                    <span className="ad-bar-num">{formatNumber(p.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function priorityLabel(p: string) {
  return { low: 'Low', medium: 'Medium', high: 'High' }[p] ?? p
}