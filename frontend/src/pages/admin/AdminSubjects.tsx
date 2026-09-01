import { adminApi } from '../../lib/adminApi'
import { useAdminData, formatNumber } from '../../lib/adminHelpers'
import AdminStatCard from '../../components/admin/AdminStatCard'

export default function AdminSubjects() {
  const { data, error, loading } = useAdminData(adminApi.studyActivity)

  const subjects = data?.popular_subjects ?? []
  const top = subjects[0]

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Subjects</h1>
          <p>Most popular subjects across the platform</p>
        </div>
      </div>

      {error && <div className="ad-alert">{error}</div>}
      {loading && <div className="ad-empty">Loading subjects...</div>}

      {!loading && !error && data && (
        <>
          <div className="ad-stats ad-stats-3">
            <AdminStatCard label="Total subjects" value={formatNumber(subjects.length ? 0 : 0)} hint="Ranked by user count" tone="violet" />
            <AdminStatCard label="Most users" value={top ? formatNumber(top.user_count) : 0} hint={top?.name ?? '—'} tone="green" />
            <AdminStatCard label="Most sessions" value={subjects.length ? formatNumber(Math.max(...subjects.map((s) => s.session_count))) : 0} hint="Focus sessions" tone="cyan" />
          </div>

          <div className="ad-card">
            <div className="ad-card-title"><h3>Popular subjects — ranked</h3><span>{subjects.length} subjects</span></div>
            {subjects.length ? (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Subject</th>
                      <th>Users</th>
                      <th>Focus sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((s, i) => (
                      <tr key={s.name}>
                        <td><strong>{i + 1}</strong></td>
                        <td><strong>{s.name || 'Unnamed'}</strong></td>
                        <td>{formatNumber(s.user_count)}</td>
                        <td>{formatNumber(s.session_count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="ad-empty">No subjects found yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}