import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber } from '../../lib/adminHelpers'
import AdminStatCard from '../../components/admin/AdminStatCard'

export default function AdminAI() {
  const { data, error, loading } = useAdminData(adminApi.ai)

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>FLOX AI</h1>
          <p>AI usage · features · cost control</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading AI analytics...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-stats">
            <AdminStatCard label="Conversations today" value={formatNumber(data.conversations_today)} hint="AI interactions" tone="violet" />
            <AdminStatCard label="Active AI users" value={formatNumber(data.active_ai_users)} hint="Used AI today" tone="green" />
            <AdminStatCard label="Avg msgs/user" value={`${data.average_messages_per_user}`} hint="Today" tone="cyan" />
            <AdminStatCard label="Total conversations" value={formatNumber(data.total_conversations)} hint="All-time" tone="amber" />
          </div>

          <div className="ad-grid">
            <div className="ad-card">
              <div className="ad-card-title"><h3>AI features</h3><span>Share of usage</span></div>
              <div className="ad-bars">
                {data.feature_breakdown.map((f) => (
                  <div className="ad-bar-row" key={f.feature}>
                    <span>{featureLabel(f.feature)}</span>
                    <div className="ad-bar-track">
                      <i className="ad-bar-fill" style={{ width: `${f.pct}%` }} />
                    </div>
                    <span className="ad-bar-num">{f.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ad-card">
              <div className="ad-card-title"><h3>Provider breakdown</h3><span>All-time</span></div>
              <div className="ad-bars">
                {data.provider_breakdown.map((p) => (
                  <div className="ad-bar-row" key={p.provider}>
                    <span>{p.provider}</span>
                    <div className="ad-bar-track">
                      <i className="ad-bar-fill mint" style={{ width: `${Math.min(100, Math.round((p.count / Math.max(data.total_conversations, 1)) * 100))}%` }} />
                    </div>
                    <span className="ad-bar-num">{formatNumber(p.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>AI usage — last 7 days</h3><span>{formatNumber(data.conversations_today)} today</span></div>
            <div className="ad-line-chart">
              {data.daily_usage.map((d) => (
                <div className="ad-line-col" key={d.date}>
                  <i className="ad-line-bar" style={{ height: `${Math.max(3, Math.round((d.count / Math.max(...data.daily_usage.map((x) => x.count), 1)) * 100))}%` }} title={`${d.date}: ${d.count}`} />
                </div>
              ))}
            </div>
            <div className="ad-line-labels">
              {data.daily_usage.map((d) => (
                <span key={d.date}>{d.date.slice(5)}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function featureLabel(f: string) {
  return { planner: 'Study planning', tutor: 'Explain topic', quiz: 'Quiz generation', burnout: 'Progress analysis' }[f] ?? f
}