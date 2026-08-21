import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
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

type ProfileForm = {
  username: string
  email: string
  bio: string
  college: string
  course: string
  semester: number
  study_goal: string
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
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ProfileForm>({
    username: '', email: '', bio: '', college: '', course: '', semester: 1, study_goal: '',
  })

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

  function fillForm(data: UserProfile) {
    const p = data.profile
    setForm({
      username: data.username,
      email: data.email,
      bio: p?.bio ?? '',
      college: p?.college ?? '',
      course: p?.course ?? '',
      semester: p?.semester ?? 1,
      study_goal: p?.study_goal ?? '',
    })
  }

  function startEdit() {
    if (profile) fillForm(profile)
    setEditing(true)
  }

  function cancelEdit() {
    if (profile) fillForm(profile)
    setEditing(false)
  }

  async function saveProfile() {
    if (!form.username.trim() || !form.email.trim()) {
      toast.error('Name and email are required.')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.patch<UserProfile>('/auth/me/', {
        username: form.username.trim(),
        email: form.email.trim(),
        bio: form.bio,
        college: form.college,
        course: form.course,
        semester: form.semester,
        study_goal: form.study_goal,
      })
      setProfile(data)
      fillForm(data)
      setEditing(false)
      setError(null)
      toast.success('Profile updated.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

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
            </div>
            <div className="profile-hero-details">
              <div className="profile-hero-name-block">
                <h2>{name}</h2>
                {profile?.email && <span>{profile.email}</span>}
              </div>
              {prof?.study_goal && (
                <span className="profile-goal-chip">&#127919; {prof.study_goal}</span>
              )}
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
              <div>
                <span className="eyebrow">Personal Information</span>
                <h2>Your Details</h2>
              </div>
              {!editing && (
                <button className="ghost-action" onClick={startEdit} type="button">Edit Profile</button>
              )}
            </div>

            {editing ? (
              <div className="profile-edit-form">
                <label>
                  Full Name
                  <input
                    onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))}
                    value={form.username}
                  />
                </label>
                <label>
                  Email
                  <input
                    onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                    type="email"
                    value={form.email}
                  />
                </label>
                <label>
                  Course
                  <input
                    onChange={(e) => setForm((c) => ({ ...c, course: e.target.value }))}
                    placeholder="e.g. B.Sc Computer Science"
                    value={form.course}
                  />
                </label>
                <label>
                  Semester
                  <input
                    max="12"
                    min="1"
                    onChange={(e) => setForm((c) => ({ ...c, semester: Number(e.target.value) }))}
                    type="number"
                    value={form.semester}
                  />
                </label>
                <label>
                  College
                  <input
                    onChange={(e) => setForm((c) => ({ ...c, college: e.target.value }))}
                    placeholder="e.g. MIT"
                    value={form.college}
                  />
                </label>
                <label>
                  Study Goal
                  <input
                    onChange={(e) => setForm((c) => ({ ...c, study_goal: e.target.value }))}
                    placeholder="e.g. Score 90%+ in semester finals"
                    value={form.study_goal}
                  />
                </label>
                <label className="profile-field-full">
                  Bio
                  <textarea
                    onChange={(e) => setForm((c) => ({ ...c, bio: e.target.value }))}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    value={form.bio}
                  />
                </label>
                <div className="profile-edit-actions">
                  <button className="ghost-action" disabled={saving} onClick={cancelEdit} type="button">Cancel</button>
                  <button className="gradient-action" disabled={saving} onClick={saveProfile} type="button">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
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
                {prof?.bio && (
                  <div className="profile-info-item profile-field-full">
                    <span className="profile-info-label">Bio</span>
                    <span className="profile-info-value">{prof.bio}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </PageShell>
  )
}
