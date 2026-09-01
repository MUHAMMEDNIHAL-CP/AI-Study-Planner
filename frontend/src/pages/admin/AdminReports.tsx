import { useState } from 'react'
import { adminApi, type ReportData } from '../../lib/adminApi'
import { getErrorMessage, API_BASE_URL } from '../../lib/api'
import { formatNumber } from '../../lib/adminHelpers'

const REPORT_TYPES = [
  { value: 'overview', label: 'Overview' },
  { value: 'users', label: 'Users' },
  { value: 'study', label: 'Study' },
  { value: 'quizzes', label: 'Quizzes' },
  { value: 'ai', label: 'AI' },
  { value: 'tasks', label: 'Tasks' },
]

export default function AdminReports() {
  const [type, setType] = useState('overview')
  const [days, setDays] = useState(30)
  const [report, setReport] = useState<ReportData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const data = await adminApi.report(type, days)
      setReport(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>Reports</h1>
          <p>Generate and export platform reports</p>
        </div>
      </div>

      <div className="ad-card">
        <div className="ad-toolbar">
          <select className="ad-btn" value={type} onChange={(e) => setType(e.target.value)} style={{ appearance: 'auto' }}>
            {REPORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select className="ad-btn" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ appearance: 'auto' }}>
            {[7, 30, 90, 180, 365].map((d) => (
              <option key={d} value={d}>Last {d} days</option>
            ))}
          </select>
          <button className="ad-btn ad-btn-primary" disabled={loading} onClick={() => void generate()} type="button">
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        {error && <div className="ad-alert" style={{ marginTop: 14 }}>{error}</div>}

        {report && (
          <>
            <div className="ad-card" style={{ marginTop: 16, boxShadow: 'none', border: '1px solid var(--line)' }}>
              <div className="ad-card-title">
                <h3>{type} report · last {days} days</h3>
              </div>
              <div className="ad-bars">
                {Object.entries(report.data).map(([k, v]) => (
                  <div className="ad-bar-row" key={k}>
                    <span>{prettyKey(k)}</span>
                    <div className="ad-bar-track">
                      <i className="ad-bar-fill" style={{ width: `${Math.min(100, Math.max(3, Number(v) / 100))}%` }} />
                    </div>
                    <span className="ad-bar-num">{formatNumber(Number(v))}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {report && (
        <div className="ad-page-actions">
          <a
            className="ad-btn ad-btn-primary"
            href={`${API_BASE_URL}/api/admin/reports/export/?type=${report.type}&days=${report.days}`}
            onClick={() => { void adminApi.logAction('exported_report', undefined, { type: report.type, days: report.days }) }}
          >
            Export CSV
          </a>
        </div>
      )}
    </div>
  )
}

function prettyKey(k: string) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}