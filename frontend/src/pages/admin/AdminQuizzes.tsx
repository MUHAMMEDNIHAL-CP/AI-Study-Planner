import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber } from '../../lib/adminHelpers'
import AdminStatCard from '../../components/admin/AdminStatCard'

export default function AdminQuizzes() {
  const { data, error, loading } = useAdminData(adminApi.quizzes)

  const totalDifficulty = data ? data.difficulty_stats.reduce((s, d) => s + d.count, 0) : 0

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Quiz Analytics</h1>
          <p>Quiz creation · difficulty · performance</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading quiz analytics...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-stats">
            <AdminStatCard label="Created today" value={formatNumber(data.created_today)} hint="Quizzes" tone="violet" />
            <AdminStatCard label="Created this week" value={formatNumber(data.created_this_week)} hint="Last 7 days" tone="cyan" />
            <AdminStatCard label="Average score" value={`${data.average_score}%`} hint="Across scored quizzes" tone="green" />
            <AdminStatCard label="AI generated" value={`${data.ai_generated_pct}%`} hint={`${formatNumber(data.ai_generated_count)} quizzes`} tone="mint" />
          </div>

          <div className="ad-grid">
            <div className="ad-card">
              <div className="ad-card-title"><h3>Question difficulty</h3><span>Correctness by level</span></div>
              <div className="ad-bars">
                {data.difficulty_stats.map((d) => (
                  <div className="ad-bar-row" key={d.difficulty}>
                    <span>{difficultyLabel(d.difficulty)}</span>
                    <div className="ad-bar-track">
                      <i className={`ad-bar-fill ${d.difficulty === 'hard' ? 'amber' : ''}`} style={{ width: `${d.avg_score ?? 0}%` }} />
                    </div>
                    <span className="ad-bar-num">{d.avg_score ?? 0}% correct</span>
                  </div>
                ))}
              </div>
              {totalDifficulty === 0 && <div className="ad-empty" style={{ marginTop: 12 }}>No quizzes yet.</div>}
            </div>

            <div className="ad-card">
              <div className="ad-card-title"><h3>Most quizzed subjects</h3><span>By topic title</span></div>
              <div className="ad-bars">
                {(data.top_topics ?? []).map((t) => (
                  <div className="ad-bar-row" key={t.topic}>
                    <span>{t.topic}</span>
                    <div className="ad-bar-track">
                      <i className="ad-bar-fill mint" style={{ width: `${Math.min(100, Math.round((t.count / Math.max(data.top_topics[0]?.count ?? 1, 1)) * 100))}%` }} />
                    </div>
                    <span className="ad-bar-num">{formatNumber(t.count)}</span>
                  </div>
                ))}
                {!data.top_topics?.length && <div className="ad-empty">No quizzes yet.</div>}
              </div>
            </div>
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>Quizzes created — last 7 days</h3><span>{formatNumber(data.created_this_week)} this week</span></div>
            <div className="ad-line-chart">
              {data.quiz_daily.map((d) => (
                <div className="ad-line-col" key={d.date}>
                  <i className="ad-line-bar" style={{ height: `${Math.max(3, Math.round((d.count / Math.max(...data.quiz_daily.map((x) => x.count), 1)) * 100))}%` }} title={`${d.date}: ${d.count}`} />
                </div>
              ))}
            </div>
            <div className="ad-line-labels">
              {data.quiz_daily.map((d) => (
                <span key={d.date}>{d.date.slice(5)}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function difficultyLabel(d: string) {
  return { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[d] ?? d
}