import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber } from '../../lib/adminHelpers'
import AdminStatCard from '../../components/admin/AdminStatCard'

export default function AdminTasks() {
  const { data, error, loading } = useAdminData(adminApi.tasks)

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Tasks</h1>
          <p>Task creation · completion · overdue</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading tasks...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-stats">
            <AdminStatCard label="Created today" value={formatNumber(data.created_today)} hint="Tasks" tone="violet" />
            <AdminStatCard label="Completed today" value={formatNumber(data.completed_today)} hint="Tasks" tone="green" />
            <AdminStatCard label="Completion rate" value={`${data.completion_rate}%`} hint="Today" tone="cyan" />
            <AdminStatCard label="Overdue" value={formatNumber(data.overdue)} hint="Past due, not done" tone="rose" />
            <AdminStatCard label="Total tasks" value={formatNumber(data.total_tasks)} hint="All-time" tone="amber" />
          </div>

          <div className="ad-grid">
            <div className="ad-card">
              <div className="ad-card-title"><h3>Tasks by status</h3><span>All-time</span></div>
              <div className="ad-bars">
                {data.by_status.map((s) => (
                  <div className="ad-bar-row" key={s.status}>
                    <span>{statusLabel(s.status)}</span>
                    <div className="ad-bar-track">
                      <i className="ad-bar-fill" style={{ width: `${Math.round((s.count / Math.max(data.total_tasks, 1)) * 100)}%` }} />
                    </div>
                    <span className="ad-bar-num">{formatNumber(s.count)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ad-card">
              <div className="ad-card-title"><h3>Tasks by priority</h3><span>All-time</span></div>
              <div className="ad-bars">
                {data.by_priority.map((p) => (
                  <div className="ad-bar-row" key={p.priority}>
                    <span>{priorityLabel(p.priority)}</span>
                    <div className="ad-bar-track">
                      <i className="ad-bar-fill amber" style={{ width: `${Math.round((p.count / Math.max(data.total_tasks, 1)) * 100)}%` }} />
                    </div>
                    <span className="ad-bar-num">{formatNumber(p.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>Created vs completed — last 7 days</h3><span>Today</span></div>
            <DailyTrend data={data.daily_trend} />
          </div>
        </>
      )}
    </div>
  )
}

function statusLabel(s: string) {
  return { todo: 'To do', doing: 'Doing', done: 'Done' }[s] ?? s
}

function priorityLabel(p: string) {
  return { low: 'Low', medium: 'Medium', high: 'High' }[p] ?? p
}

function DailyTrend({ data }: { data: Array<{ date: string; created: number; completed: number }> }) {
  const max = Math.max(...data.map((d) => d.created), 1)
  return (
    <>
      <div className="ad-line-chart" style={{ height: 90 }}>
        {data.map((d) => (
          <div className="ad-line-col" key={d.date} style={{ position: 'relative' }}>
            <i
              className="ad-line-bar"
              style={{ height: `${Math.max(3, Math.round((d.created / max) * 100))}%`, background: 'linear-gradient(180deg, var(--purple), rgba(126,34,206,0.25))' }}
              title={`Created: ${d.date}`}
            />
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