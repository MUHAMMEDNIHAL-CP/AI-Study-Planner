import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber } from '../../lib/adminHelpers'
import AdminStatCard from '../../components/admin/AdminStatCard'

export default function AdminNotes() {
  const { data, error, loading } = useAdminData(adminApi.notes)

  const max = data ? Math.max(...data.daily_trend.map((d) => d.count), 1) : 1

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Notes</h1>
          <p>Notes activity across the platform</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading notes analytics...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-stats">
            <AdminStatCard label="Created today" value={formatNumber(data.created_today)} hint="Notes" tone="violet" />
            <AdminStatCard label="Created this week" value={formatNumber(data.created_this_week)} hint="Last 7 days" tone="cyan" />
            <AdminStatCard label="Active note users" value={formatNumber(data.active_note_users)} hint="Wrote a note this week" tone="green" />
            <AdminStatCard label="Avg notes/user" value={`${data.average_per_user}`} hint="Active users" tone="amber" />
            <AdminStatCard label="Total notes" value={formatNumber(data.total_notes)} hint="All-time" tone="mint" />
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>Notes created — last 7 days</h3><span>{formatNumber(data.created_this_week)} this week</span></div>
            <div className="ad-line-chart">
              {data.daily_trend.map((d) => (
                <div className="ad-line-col" key={d.date}>
                  <i className="ad-line-bar" style={{ height: `${Math.max(3, Math.round((d.count / max) * 100))}%` }} title={`${d.date}: ${d.count}`} />
                </div>
              ))}
            </div>
            <div className="ad-line-labels">
              {data.daily_trend.map((d) => (
                <span key={d.date}>{d.date.slice(5)}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}