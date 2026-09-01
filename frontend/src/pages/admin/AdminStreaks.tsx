import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber } from '../../lib/adminHelpers'
import AdminStatCard from '../../components/admin/AdminStatCard'

export default function AdminStreaks() {
  const { data, error, loading } = useAdminData(adminApi.streaks)

  const maxBucket = data ? Math.max(...data.distribution.map((d) => d.count), 1) : 1
  const total = data ? data.distribution.reduce((s, d) => s + d.count, 0) : 0

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Streak Analytics</h1>
          <p>Streak distribution · 30-minute daily goal completion</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading streak data...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-stats">
            <AdminStatCard label="Average streak" value={`${data.average_streak} days`} hint="Across active learners" tone="violet" />
            <AdminStatCard label="Active streak" value={formatNumber(data.active_streak_users)} hint="Current streak ≥ 1 day" tone="green" />
            <AdminStatCard label="7+ day streak" value={formatNumber(data.streak_7plus)} hint="Users" tone="cyan" />
            <AdminStatCard label="30+ day streak" value={formatNumber(data.streak_30plus)} hint="Highly consistent" tone="amber" />
            <AdminStatCard label="Longest streak" value={`${formatNumber(data.longest_streak)} days`} hint="Platform record" tone="rose" />
            <AdminStatCard label="Completed 30-min goal" value={`${data.completed_30min_pct}%`} hint={`${formatNumber(data.completed_30min_today)} users today`} tone="mint" />
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>Streak distribution</h3><span>{formatNumber(total)} users with study logs</span></div>
            <div className="ad-bars">
              {data.distribution.map((d) => (
                <div className="ad-bar-row" key={d.range}>
                  <span>{d.range} days</span>
                  <div className="ad-bar-track">
                    <i className="ad-bar-fill" style={{ width: `${Math.round((d.count / maxBucket) * 100)}%` }} />
                  </div>
                  <span className="ad-bar-num">{formatNumber(d.count)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>30-minute daily requirement</h3><span>Today</span></div>
            <div className="ad-funnel">
              <div className="ad-funnel-row">
                <span className="ad-funnel-label">Completed (30+ min)</span>
                <div className="ad-funnel-track">
                  <i className="ad-funnel-fill" style={{ width: `${data.completed_30min_pct}%` }} />
                </div>
                <span className="ad-funnel-num">{data.completed_30min_pct}%</span>
              </div>
              <div className="ad-funnel-row">
                <span className="ad-funnel-label">Not completed</span>
                <div className="ad-funnel-track">
                  <i className="ad-funnel-fill" style={{ width: `${100 - data.completed_30min_pct}%` }} />
                </div>
                <span className="ad-funnel-num">{100 - data.completed_30min_pct}%</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}