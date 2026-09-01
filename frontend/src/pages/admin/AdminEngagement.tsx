import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber } from '../../lib/adminHelpers'
import AdminStatCard from '../../components/admin/AdminStatCard'

export default function AdminEngagement() {
  const { data, error, loading } = useAdminData(adminApi.engagement)

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Engagement</h1>
          <p>DAU / WAU / MAU · activation · retention · churn</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading engagement data...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-stats">
            <AdminStatCard label="DAU" value={formatNumber(data.dau)} hint="Active today" tone="green" />
            <AdminStatCard label="WAU" value={formatNumber(data.wau)} hint="Active last 7 days" tone="cyan" />
            <AdminStatCard label="MAU" value={formatNumber(data.mau)} hint="Active last 30 days" tone="violet" />
            <AdminStatCard label="Activation" value={`${data.activation_rate}%`} hint="Completed onboarding" tone="mint" />
            <AdminStatCard label="Churn" value={`${data.churn_rate}%`} hint={`${formatNumber(data.churned_users)} users churned`} tone="rose" />
            <AdminStatCard label="New today" value={formatNumber(data.new_today)} hint="Registrations" tone="amber" />
            <AdminStatCard label="Returning today" value={formatNumber(data.returning_today)} hint="Active users registered earlier" tone="green" />
            <AdminStatCard label="Total users" value={formatNumber(data.total_users)} hint="All-time" />
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>Daily active users — last 14 days</h3><span>{formatNumber(data.dau)} today</span></div>
            <DauChart data={data.dau_trend} />
          </div>

          <div className="ad-grid">
            <div className="ad-card">
              <div className="ad-card-title"><h3>Stickiness</h3><span>DAU / MAU</span></div>
              <div className="ad-bars">
                {[
                  { label: 'DAU', value: data.dau, max: data.mau },
                  { label: 'WAU', value: data.wau, max: data.mau },
                  { label: 'MAU', value: data.mau, max: data.mau },
                ].map((row) => (
                  <div className="ad-bar-row" key={row.label}>
                    <span>{row.label}</span>
                    <div className="ad-bar-track">
                      <i className="ad-bar-fill" style={{ width: `${Math.round((row.value / row.max) * 100)}%` }} />
                    </div>
                    <span className="ad-bar-num">{formatNumber(row.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ad-card">
              <div className="ad-card-title"><h3>Daily mix</h3><span>Today</span></div>
              <div className="ad-bars">
                <div className="ad-bar-row" style={{ gridTemplateColumns: '1fr 46px' }}>
                  <span>New users</span>
                  <span className="ad-bar-num">{formatNumber(data.new_today)}</span>
                </div>
                <div className="ad-bar-row" style={{ gridTemplateColumns: '1fr 46px' }}>
                  <span>Returning users</span>
                  <span className="ad-bar-num">{formatNumber(data.returning_today)}</span>
                </div>
                <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '6px 0' }} />
                <div className="ad-bar-row" style={{ gridTemplateColumns: '1fr 46px' }}>
                  <span>Activation rate</span>
                  <span className="ad-bar-num">{data.activation_rate}%</span>
                </div>
                <div className="ad-bar-row" style={{ gridTemplateColumns: '1fr 46px' }}>
                  <span>Churn rate</span>
                  <span className="ad-bar-num">{data.churn_rate}%</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function DauChart({ data }: { data: Array<{ date: string; dau: number }> }) {
  const max = Math.max(...data.map((d) => d.dau), 1)
  return (
    <>
      <div className="ad-line-chart">
        {data.map((d) => (
          <div className="ad-line-col" key={d.date}>
            <i className="ad-line-bar" style={{ height: `${Math.max(3, Math.round((d.dau / max) * 100))}%` }} title={`${d.date}: ${d.dau}`} />
          </div>
        ))}
      </div>
      <div className="ad-line-labels">
        {data.map((d) => (
          <span key={d.date}>{d.date.slice(5)}</span>
        ))}
      </div>
    </>
  )
}