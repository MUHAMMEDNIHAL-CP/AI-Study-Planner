import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber, formatHours } from '../../lib/adminHelpers'
import AdminStatCard from '../../components/admin/AdminStatCard'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function AdminStudyActivity() {
  const { data, error, loading } = useAdminData(adminApi.studyActivity)

  const maxBar = data ? Math.max(...data.daily_study.map((d) => d.minutes), 1) : 1

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Study Activity</h1>
          <p>Study time · focus sessions · goal completion</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading study activity...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-stats">
            <AdminStatCard label="Study time today" value={formatHours(data.total_study_minutes_today)} hint="Across all users" tone="green" />
            <AdminStatCard label="Study time this week" value={formatHours(data.total_study_minutes_week)} hint="Last 7 days" tone="cyan" />
            <AdminStatCard label="Focus sessions" value={formatNumber(data.focus_sessions_today)} hint={`${formatNumber(data.completed_sessions_today)} completed`} tone="violet" />
            <AdminStatCard label="Average session" value={`${data.average_session_minutes} min`} hint="Today" tone="amber" />
            <AdminStatCard label="30-min goal met" value={`${data.goal_completion_pct}%`} hint={`${formatNumber(data.completed_30min_goal)} users`} tone="mint" />
          </div>

          <div className="ad-grid">
            <div className="ad-card">
              <div className="ad-card-title"><h3>Average study time / day</h3><span>Last 7 days</span></div>
              <div className="ad-line-chart">
                {data.daily_study.map((d) => (
                  <div className="ad-line-col" key={d.date}>
                    <i
                      className="ad-line-bar"
                      style={{ height: `${Math.max(3, Math.round((d.minutes / maxBar) * 100))}%` }}
                      title={`${new Date(d.date).toLocaleDateString()}: ${formatHours(d.minutes)}`}
                    />
                  </div>
                ))}
              </div>
              <div className="ad-line-labels">
                {data.daily_study.map((d) => (
                  <span key={d.date}>{DAY_LETTERS[new Date(d.date).getDay()]}</span>
                ))}
              </div>
            </div>

            <div className="ad-card">
              <div className="ad-card-title"><h3>Most popular subjects</h3><span>By users</span></div>
              <div className="ad-bars">
                {(data.popular_subjects ?? []).length ? (
                  data.popular_subjects.map((s) => {
                    const pct = Math.round((s.user_count / data.popular_subjects[0].user_count) * 100)
                    return (
                      <div className="ad-bar-row" key={s.name}>
                        <span>{s.name}</span>
                        <div className="ad-bar-track">
                          <i className="ad-bar-fill mint" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="ad-bar-num">{formatNumber(s.user_count)}</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="ad-empty">No subjects added yet.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}