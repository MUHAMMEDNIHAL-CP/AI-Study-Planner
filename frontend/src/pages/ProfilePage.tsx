import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getErrorMessage } from '../lib/api'
import { clearAuthTokens } from '../lib/auth'
import PageShell from '../components/PageShell'

type UserProfile = {
  id: number
  username: string
  email: string
  profile?: {
    bio: string
    college: string
    course: string
    semester: number
    study_goal: string
  }
}

type DashboardData = {
  current_streak: number
  longest_streak: number
  total_study_days: number
  studied_today: boolean
  week_minutes: number
  completion_rate: number
  open_tasks: number
}

type AnalyticsData = {
  total_minutes: number
  average_focus: number
  completed_tasks: number
}

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([
      api.get<UserProfile>('/auth/me/'),
      api.get<DashboardData>('/study/dashboard/').catch(() => ({ data: null })),
      api.get<AnalyticsData>('/productivity/analytics/').catch(() => ({ data: null })),
    ]).then(([profileRes, dashRes, analyticsRes]) => {
      if (!active) return
      setProfile(profileRes.data)
      setDashData(dashRes.data)
      setAnalyticsData(analyticsRes.data)
    }).catch((err) => {
      if (!active) return
      setError(getErrorMessage(err))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  function logout() {
    clearAuthTokens()
    navigate('/login')
  }

  const name = profile?.username ?? 'Scholar'
  const avatar = userInitials(name)
  const prof = profile?.profile
  const totalHours = analyticsData ? Math.round((analyticsData.total_minutes || 0) / 60) : 0
  const completedTasks = analyticsData?.completed_tasks ?? 0
  const streak = dashData?.current_streak ?? 0

  const subtitle = prof?.course
    ? `${prof.course}${prof.semester ? ` \u00B7 Semester ${prof.semester}` : ''}`
    : 'Your Flox AI identity and stats.'

  return (
    <PageShell
      className="profile-page-shell"
      eyebrow="PROFILE"
      subtitle={subtitle}
      title={name}
      actions={
        <div className="profile-hero-actions">
          <Link className="gradient-action" to="/settings">Edit Profile</Link>
          <button className="ghost-action" onClick={logout} type="button">Logout</button>
        </div>
      }
    >
      {error && <div className="auth-alert">{error}</div>}

      {loading ? (
        <div className="dashboard-loading">Loading profile...</div>
      ) : (
        <>
          <section className="profile-hero-card">
            <div className="profile-hero-avatar">
              <span>{avatar}</span>
              {prof?.study_goal && <small>{prof.study_goal}</small>}
            </div>
            <div className="profile-hero-details">
              <div className="profile-hero-name-block">
                <h2>{name}</h2>
                {profile?.email && <span>{profile.email}</span>}
              </div>
              {(prof?.college || prof?.bio) && (
                <div className="profile-hero-meta">
                  {prof?.college && <span>{prof.college}</span>}
                  {prof?.bio && <p>{prof.bio}</p>}
                </div>
              )}
            </div>
          </section>

          <section className="profile-stats-grid">
            <div className="profile-stat-card">
              <div className="profile-stat-icon-wrap profile-stat-coral">
                <span>&#x1F525;</span>
              </div>
              <div>
                <span>Study Streak</span>
                <strong>{streak} day{streak === 1 ? '' : 's'}</strong>
              </div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-icon-wrap profile-stat-mint">
                <span>&#x23F1;&#xFE0F;</span>
              </div>
              <div>
                <span>Total Hours</span>
                <strong>{totalHours}h</strong>
              </div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-icon-wrap profile-stat-violet">
                <span>&#x2713;</span>
              </div>
              <div>
                <span>Tasks Done</span>
                <strong>{completedTasks}</strong>
              </div>
            </div>
          </section>

          <section className="page-card profile-info-section">
            <div className="profile-info-head">
              <span className="eyebrow">Personal Information</span>
              <h2>Your Details</h2>
            </div>
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <span className="profile-info-label">Name</span>
                <span className="profile-info-value">{name}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Email</span>
                <span className="profile-info-value">{profile?.email ?? 'Not set'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Course</span>
                <span className="profile-info-value">{prof?.course || 'Not set'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Semester</span>
                <span className="profile-info-value">{prof?.semester ? `Semester ${prof.semester}` : 'Not set'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">College</span>
                <span className="profile-info-value">{prof?.college || 'Not set'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Study Goal</span>
                <span className="profile-info-value">{prof?.study_goal || 'Not set'}</span>
              </div>
            </div>
          </section>
        </>
      )}
    </PageShell>
  )
}
