import { useAdminData, formatNumber, formatCompact, formatHours } from '../../lib/adminHelpers'
import { adminApi } from '../../lib/adminApi'
import AdminStatCard from '../../components/admin/AdminStatCard'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function AdminOverview() {
  const { data, error, loading } = useAdminData(adminApi.overview)

  const today = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>{greeting()}, Admin</h1>
          <p>Platform overview · {today}</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading platform data...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-stats">
            <AdminStatCard label="Users" value={formatNumber(data.total_users)} hint="Total registered" />
            <AdminStatCard label="Active today" value={formatNumber(data.active_today)} hint={`${formatNumber(data.active_week)} this week`} tone="green" />
            <AdminStatCard label="Studying today" value={formatNumber(data.studying_today)} hint="Focus sessions started" tone="violet" />
            <AdminStatCard label="Retention" value={`${data.retention_rate}%`} hint="7 days · week over week" tone="amber" />
            <AdminStatCard label="New users" value={formatNumber(data.new_today)} hint={`${formatNumber(data.new_this_month)} this month`} tone="cyan" />
            <AdminStatCard label="Study time today" value={formatHours(data.total_study_minutes_today)} hint={`${formatNumber(data.focus_sessions_today)} focus sessions`} tone="mint" />
            <AdminStatCard label="AI conversations" value={formatNumber(data.ai_today)} hint="Today" tone="violet" />
            <AdminStatCard label="Upcoming exams" value={formatNumber(data.upcoming_exams)} hint="Across platform" tone="amber" />
          </div>

          <div className="ad-card">
            <div className="ad-card-title">
              <h3>User growth — last 30 days</h3>
              <span>{formatNumber(data.new_this_week)} new this week</span>
            </div>
            <UserGrowthChart data={data.user_growth} />
          </div>

          <div className="ad-grid">
            <div className="ad-card">
              <div className="ad-card-title"><h3>Most used features</h3><span>Last 7 days</span></div>
              <div className="ad-bars">
                {data.most_used_features.map((f) => (
                  <div className="ad-bar-row" key={f.name}>
                    <span>{f.name}</span>
                    <div className="ad-bar-track">
                      <i className="ad-bar-fill" style={{ width: `${f.pct}%` }} />
                    </div>
                    <span className="ad-bar-num">{f.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ad-card">
              <div className="ad-card-title"><h3>Platform activity</h3><span>Last 7 days</span></div>
              <div className="ad-bars">
                {[
                  { name: 'Tasks', count: data.platform_activity.tasks },
                  { name: 'AI messages', count: data.platform_activity.ai_messages },
                  { name: 'Sessions', count: data.platform_activity.sessions },
                  { name: 'Quizzes', count: data.platform_activity.quizzes },
                  { name: 'Notes', count: data.platform_activity.notes },
                ].map((row) => (
                  <div className="ad-bar-row" key={row.name}>
                    <span>{row.name}</span>
                    <div className="ad-bar-track">
                      <i className="ad-bar-fill mint" style={{ width: `${Math.min(100, row.count)}%` }} />
                    </div>
                    <span className="ad-bar-num">{formatCompact(row.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>Active learner funnel</h3><span>Product health</span></div>
            <div className="ad-funnel">
              {[
                { label: 'Registered', value: data.funnel.registered, pct: 100 },
                { label: 'Active this month', value: data.funnel.active_this_month, pct: Math.round((data.funnel.active_this_month / data.funnel.registered) * 100) },
                { label: 'Studied this week', value: data.funnel.studied_this_week, pct: Math.round((data.funnel.studied_this_week / data.funnel.registered) * 100) },
                { label: `Returned next week (${data.funnel.retention_rate}%)`, value: Math.round(data.funnel.studied_this_week * (data.funnel.retention_rate / 100)), pct: Math.round(data.funnel.studied_this_week ? (Math.round(data.funnel.studied_this_week * (data.funnel.retention_rate / 100)) / data.funnel.registered) * 100 : 0) },
              ].map((row) => (
                <div className="ad-funnel-row" key={row.label}>
                  <span className="ad-funnel-label">{row.label}</span>
                  <div className="ad-funnel-track">
                    <i className="ad-funnel-fill" style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className="ad-funnel-num">{formatNumber(row.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function UserGrowthChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <>
      <div className="ad-line-chart">
        {data.map((d) => (
          <div className="ad-line-col" key={d.date}>
            <i
              className="ad-line-bar"
              style={{ height: `${Math.max(3, Math.round((d.count / max) * 100))}%` }}
              title={`${d.date}: ${d.count}`}
            />
          </div>
        ))}
      </div>
      <div className="ad-line-labels">
        {data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map((d) => (
          <span key={d.date}>{d.date.slice(5)}</span>
        ))}
      </div>
    </>
  )
}