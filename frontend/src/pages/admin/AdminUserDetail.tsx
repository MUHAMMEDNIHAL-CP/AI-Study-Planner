import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { adminApi } from '../../lib/adminApi'
import { formatNumber, formatDate } from '../../lib/adminHelpers'
import { getErrorMessage } from '../../lib/api'
import AdminStatCard from '../../components/admin/AdminStatCard'

type UserDetail = Record<string, any>

export default function AdminUserDetail() {
  const { userId } = useParams()
  const [data, setData] = useState<UserDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) return
    let active = true
    adminApi.userDetail(userId)
      .then((d) => { if (active) setData(d) })
      .catch((err) => { if (active) setError(getErrorMessage(err)) })
    return () => { active = false }
  }, [userId])

  if (error) return <div className="ad-page"><div className="ad-alert">{error}</div></div>
  if (!data) return <div className="ad-page"><div className="ad-empty">Loading user...</div></div>

  const user = data.user as { id: number; username: string; email: string; full_name: string; date_joined: string; last_active: string | null; is_active: boolean; is_staff: boolean; is_superuser: boolean }
  const profile = (data.profile ?? {}) as Record<string, any>
  const act = (data.activity ?? {}) as Record<string, any>

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1>{user.full_name || user.username}</h1>
          <p>{user.email} · joined {formatDate(user.date_joined)}</p>
        </div>
      </div>

      <div className="ad-stats ad-stats-3">
        <AdminStatCard label="Current streak" value={`${formatNumber(act.current_streak)} days`} hint="Consecutive study days" tone="violet" />
        <AdminStatCard label="Total focus sessions" value={formatNumber(act.focus_sessions)} hint={`${formatNumber(act.focus_completed)} completed`} tone="green" />
        <AdminStatCard label="Total study time" value={formatMinutes(act.total_study_minutes)} hint={`${formatNumber(act.study_days_30)} min last 30 days`} tone="cyan" />
        <AdminStatCard label="Tasks" value={formatNumber(act.total_tasks)} hint={`${formatNumber(act.tasks_done)} done`} tone="amber" />
        <AdminStatCard label="Quizzes" value={formatNumber(act.total_quizzes)} hint="All-time" tone="mint" />
        <AdminStatCard label="AI history" value={formatNumber(act.ai_history)} hint="Conversations" tone="rose" />
      </div>

      <div className="ad-grid">
        <div className="ad-card">
          <div className="ad-card-title"><h3>Account</h3><span>ID #{user.id}</span></div>
          <div className="ad-bars">
            <InfoRow label="Username" value={user.username} />
            <InfoRow label="Status" value={user.is_active ? 'Active' : 'Suspended'} />
            <InfoRow label="Role" value={user.is_superuser ? 'Super Admin' : user.is_staff ? 'Staff' : 'Student'} />
            <InfoRow label="Last active" value={user.last_active ? formatDate(user.last_active) : '—'} />
            <InfoRow label="Education" value={[profile.education_level, profile.course, profile.college].filter(Boolean).join(' · ') || '—'} />
            <InfoRow label="Daily study goal" value={profile.daily_study_goal != null ? `${profile.daily_study_goal} hours` : '—'} />
            <InfoRow label="Onboarding" value={profile.onboarding_completed ? 'Completed' : 'Not completed'} />
          </div>
        </div>

        <div className="ad-card">
          <div className="ad-card-title"><h3>Study activity</h3><span>All-time</span></div>
          <div className="ad-bars">
            <InfoRow label="Subjects" value={formatNumber(act.total_subjects)} />
            <InfoRow label="Notes" value={formatNumber(act.total_notes)} />
            <InfoRow label="Tasks done" value={`${formatNumber(act.tasks_done)} / ${formatNumber(act.total_tasks)}`} />
            <InfoRow label="Focus completion rate" value={`${act.focus_sessions ? Math.round((act.focus_completed / act.focus_sessions) * 100) : 0}%`} />
            <InfoRow label="Study minutes (7d)" value={formatNumber(act.study_days_7)} />
            <InfoRow label="Study minutes (30d)" value={formatNumber(act.study_days_30)} />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ad-bar-row" style={{ gridTemplateColumns: '160px 1fr' }}>
      <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{label}</span>
      <strong style={{ fontSize: '0.9rem' }}>{value}</strong>
    </div>
  )
}

function formatMinutes(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h ${m}m` : `${m}m`
}