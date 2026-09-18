import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import SetupChecklist from '../components/SetupChecklist'
import { api, getErrorMessage } from '../lib/api'
import { notifyStudyActivity } from '../lib/studyActivity'
import { markOnboardingComplete } from '../lib/tour'
import { useStreak } from '../hooks/useStreak'

type ApiSubject = { id: number; name: string; weak_topics: string; weekly_goal_hours: number }
type ApiExam = {
  id: number
  subject: number | null
  subject_name?: string
  title: string
  date: string
  priority: string
  preparation_pct?: number
  days_left?: number
}
type ApiTask = {
  id: number
  subject: number | null
  subject_name?: string
  title: string
  due_date: string | null
  scheduled_for: string | null
  duration_minutes: number
  priority: string
  status: 'todo' | 'doing' | 'done'
}
type StreakMilestone = { target: number; progress: number; remaining: number }
type FocusSession = { id: number; subject_name?: string; topic?: string; duration_minutes: number; started_at: string; completed?: boolean }
type DashboardSummary = {
  current_streak: number
  longest_streak: number
  studied_today: boolean
  next_milestone: StreakMilestone | null
  week_minutes: number
  prev_week_minutes?: number
  open_tasks: number
  upcoming_exams: ApiExam[]
  recent_logs: Array<{ date: string; minutes_studied: number }>
  today_tasks?: Array<{ id: number; title: string; subject: string | null; status: string }>
  subjects_summary?: Array<{ name: string; color: string; topics_completed: number; total_topics: number; weekly_goal_hours: number }>
  today_minutes?: number
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return { word: 'morning', emoji: '\uD83C\uDF05' }
  if (h < 17) return { word: 'afternoon', emoji: '\u2600\uFE0F' }
  return { word: 'evening', emoji: '\uD83C\uDF19' }
}

function todayInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function longDate() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h ? `${h}h ${min}m` : `${min}m`
}

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  return `${Math.floor(hrs / 24)} day(s) ago`
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))
}

function lastSevenDays() {
  const days: Array<{ date: string; dow: number }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, dow: d.getDay() })
  }
  return days
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [subjects, setSubjects] = useState<ApiSubject[]>([])
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [exams, setExams] = useState<ApiExam[]>([])
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null)
  const [firstName, setFirstName] = useState('Scholar')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [dailyGoalHours, setDailyGoalHours] = useState(4)

  const { streak: sharedStreak, refresh: refreshStreak } = useStreak()

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [profileRes, dashRes, subjRes, taskRes, examRes, sessRes] = await Promise.all([
          api.get<{ full_name?: string; username?: string; profile?: { education_level: string; course: string; college: string; semester: number; daily_study_goal: number } }>('/auth/me/'),
          api.get<DashboardSummary>('/study/dashboard/'),
          api.get<ApiSubject[]>('/study/subjects/'),
          api.get<ApiTask[]>('/study/tasks/'),
          api.get<ApiExam[]>('/study/exams/').catch(() => ({ data: [] as ApiExam[] })),
          api.get<FocusSession[]>('/productivity/focus-sessions/').catch(() => ({ data: [] as FocusSession[] })),
        ])
        if (!active) return
        setFirstName((profileRes.data.full_name || profileRes.data.username || 'Scholar').split(/\s+/)[0])
        if (profileRes.data.profile?.daily_study_goal) setDailyGoalHours(profileRes.data.profile.daily_study_goal)
        setDashboard(dashRes.data)
        setSubjects(subjRes.data)
        setTasks(taskRes.data)
        setExams(examRes.data)
        setSessions(sessRes.data)
        setError(null)
      } catch (err) {
        if (active) setError(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  // Streak comes from the shared useStreak hook (single source of truth),
  // not from this page's own API call.
  const streak = sharedStreak?.current_streak ?? dashboard?.current_streak ?? 0
  const streakLoading = sharedStreak === null
  const subjectsSummary = useMemo(() => dashboard?.subjects_summary ?? [], [dashboard])
  const recentLogs = useMemo(() => dashboard?.recent_logs ?? [], [dashboard])
  const todayMinutes = dashboard?.today_minutes ?? 0
  const dailyGoalMinutes = Math.max(Math.round((dailyGoalHours || 4) * 60), 30)

  const mainGoalPct = useMemo(() => {
    if (dailyGoalMinutes <= 0) return 0
    return Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100))
  }, [todayMinutes, dailyGoalMinutes])

  const todaysTasks = useMemo(() => {
    const day = todayInput()
    return tasks.filter((t) => t.scheduled_for?.slice(0, 10) === day || t.due_date === day)
  }, [tasks])

  const todaysDone = todaysTasks.filter((t) => t.status === 'done').length

  const nearestExam = useMemo(() => {
    const upcoming = (dashboard?.upcoming_exams ?? []).filter((e) => e.date >= todayInput())
    upcoming.sort((a, b) => a.date.localeCompare(b.date))
    return upcoming[0] ?? null
  }, [dashboard])

  const lastSession = sessions.length ? sessions[0] : null
  const continueSubjectPct = useMemo(() => {
    if (!lastSession?.subject_name) return null
    const match = subjectsSummary.find((s) => s.name === lastSession.subject_name)
    if (!match || !match.total_topics) return null
    return Math.round((match.topics_completed / match.total_topics) * 100)
  }, [lastSession, subjectsSummary])

  const aiInsight = useMemo(() => {
    const hasData = subjects.length > 0 || Boolean(nearestExam)
    const weak = subjects.filter((s) => s.weak_topics)
    let text = 'Start a focus session to build momentum.'
    let detail = 'Even 25 focused minutes makes a difference.'
    let minutes = 25
    if (nearestExam && weak.length) {
      text = `I recommend studying ${weak[0].name} next.`
      detail = `Your exam "${nearestExam.title}" is in ${nearestExam.days_left ?? 0} days and ${weak[0].weak_topics.split(',')[0].trim()} is currently your weakest topic.`
      minutes = 50
    } else if (weak.length) {
      text = `I recommend studying ${weak[0].name} next.`
      detail = `Focus on: ${weak[0].weak_topics.split(',').slice(0, 2).join(', ').trim()}.`
      minutes = 45
    } else if (nearestExam) {
      text = `Keep preparing for ${nearestExam.title}.`
      detail = `You have ${nearestExam.days_left ?? 0} days left. Stay consistent.`
      minutes = 50
    }
    return { hasData, text, detail, minutes }
  }, [subjects, nearestExam])

  const setupState = useMemo(
    () => ({
      accountDone: true,
      subjectDone: subjects.length > 0,
      taskDone: tasks.length > 0,
      examDone: exams.length > 0,
      focusDone: sessions.some((s) => s.completed && s.duration_minutes >= 30),
    }),
    [subjects, tasks, exams, sessions],
  )

  const allSetupDone = Object.values(setupState).every(Boolean)
  const onboardedRef = useRef(false)
  useEffect(() => {
    if (allSetupDone && !onboardedRef.current) {
      onboardedRef.current = true
      void markOnboardingComplete()
    }
  }, [allSetupDone])

  const weekBars = useMemo(() => {
    const logMap = new Map(recentLogs.map((l) => [l.date, l.minutes_studied]))
    const days = lastSevenDays()
    const maxMin = Math.max(...days.map((d) => logMap.get(d.date) ?? 0), 60)
    return days.map((d) => {
      const mins = logMap.get(d.date) ?? 0
      return { key: d.date, label: DAY_LETTERS[d.dow], minutes: mins, pct: Math.max(6, Math.round((mins / maxMin) * 100)) }
    })
  }, [recentLogs])

  const weekDelta = useMemo(() => {
    const cur = dashboard?.week_minutes ?? 0
    const prev = dashboard?.prev_week_minutes ?? 0
    if (!prev) return null
    return Math.round(((cur - prev) / prev) * 100)
  }, [dashboard])

  const taskList = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done')
    const source = open.length ? open : tasks
    return [...source]
      .sort((a, b) => {
        const da = a.scheduled_for ?? a.due_date ?? '9999-12-31'
        const dbb = b.scheduled_for ?? b.due_date ?? '9999-12-31'
        return da.localeCompare(dbb)
      })
      .slice(0, 5)
  }, [tasks])

  const toggleTask = useCallback(async (task: ApiTask) => {
    const next = task.status === 'done' ? 'todo' : 'done'
    setSavingTaskId(task.id)
    setTasks((c) => c.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    try {
      await api.patch(`/study/tasks/${task.id}/`, { status: next })
      if (next === 'done') {
        notifyStudyActivity()
        void refreshStreak()
      }
      const { data } = await api.get<DashboardSummary>('/study/dashboard/')
      setDashboard(data)
    } catch (err) {
      setTasks((c) => c.map((t) => (t.id === task.id ? task : t)))
      setError(getErrorMessage(err))
    } finally {
      setSavingTaskId(null)
    }
  }, [])

  const addTask = useCallback(async () => {
    const title = newTaskTitle.trim()
    if (!title) return
    setNewTaskTitle('')
    try {
      const { data: created } = await api.post<ApiTask>('/study/tasks/', { title, status: 'todo', priority: 'medium' })
      notifyStudyActivity()
      void refreshStreak()
      setTasks((c) => [...c, created])
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [newTaskTitle])

  const hello = greeting()

  return (
    <PageShell className="db-page" title="" subtitle="" hideBack>
      {error ? <div className="db-alert">{error}</div> : null}
      {loading ? (
        <div className="dash-skeleton" aria-hidden="true">
          <div className="dash-skel dash-skel-hero" />
          <div className="dash-skel dash-skel-card" />
          <div className="dash-skel-grid">
            <div className="dash-skel dash-skel-tile" />
            <div className="dash-skel dash-skel-tile" />
            <div className="dash-skel dash-skel-tile" />
            <div className="dash-skel dash-skel-tile" />
          </div>
          <div className="dash-skel dash-skel-card" />
          <div className="dash-skel dash-skel-card" />
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="dash-greeting">
            <p className="dash-greeting-date">{longDate()}</p>
            <h1 className="dash-greeting-title">
              Good {hello.word}, {firstName} {hello.emoji}
            </h1>
            <p className="dash-greeting-sub">Ready to study?</p>
          </section>

          {!allSetupDone ? <SetupChecklist state={setupState} /> : null}

          <div className="dash-grid">
            <section className="dash-card dash-progress">
              <span className="dash-eyebrow">{'\uD83C\uDFAF'} Today's Progress</span>
              <div className="dash-progress-main">
                <strong>{formatMinutes(todayMinutes)}</strong>
                <span>of {formatMinutes(dailyGoalMinutes)} goal</span>
              </div>
              <div className="dash-progress-track">
                <div className="dash-progress-fill" style={{ width: `${mainGoalPct}%` }} />
              </div>
              <p className="dash-progress-meta">
                {todaysTasks.length
                  ? `${todaysDone} / ${todaysTasks.length} tasks completed`
                  : 'No tasks scheduled for today'}
              </p>
            </section>

            <section className="dash-card dash-quick">
              <span className="dash-eyebrow">{'\u26A1'} Quick Actions</span>
              <div className="dash-quick-grid">
                <Link className="dash-quick-btn" to="/tasks">
                  <span className="dash-quick-ico add">+</span>
                  <span>Add Task</span>
                </Link>
                <Link className="dash-quick-btn" to="/notes">
                  <span className="dash-quick-ico">{'\uD83D\uDCDD'}</span>
                  <span>New Note</span>
                </Link>
                <Link className="dash-quick-btn" to="/quiz">
                  <span className="dash-quick-ico">{'\uD83E\uDDE0'}</span>
                  <span>Create Quiz</span>
                </Link>
                <Link className="dash-quick-btn" to="/focus">
                  <span className="dash-quick-ico">{'\uD83C\uDFAF'}</span>
                  <span>Start Focus</span>
                </Link>
              </div>
            </section>

            <section className="dash-card dash-tasks">
              <div className="dash-head">
                <span className="dash-eyebrow">{'\u2705'} Today's Tasks</span>
                <Link className="dash-seeall" to="/tasks">See all</Link>
              </div>
              <div className="dash-task-list">
                {taskList.map((task) => (
                  <div key={task.id} className="dash-task-row">
                    <button
                      aria-label={task.status === 'done' ? 'Mark as not done' : 'Mark as done'}
                      className={`dash-check ${task.status === 'done' ? 'done' : ''}`}
                      disabled={savingTaskId === task.id}
                      onClick={() => void toggleTask(task)}
                      type="button"
                    >
                      {task.status === 'done' ? '\u2713' : ''}
                    </button>
                    <span className={`dash-task-text ${task.status === 'done' ? 'done' : ''}`}>
                      <strong>{task.title}</strong>
                      <small>
                        {
                          [
                            task.subject_name,
                            task.scheduled_for ? formatTime(task.scheduled_for) : '',
                            task.duration_minutes ? `${task.duration_minutes} min` : '',
                          ]
                            .filter(Boolean)
                            .join(' \u00B7 ')
                        }
                      </small>
                    </span>
                  </div>
                ))}
                {!taskList.length ? (
                  <div className="dash-empty">
                    <p className="dash-empty-title">No tasks yet</p>
                    <p className="dash-empty-body">Create your first study task to start planning your day.</p>
                    <Link className="dash-empty-btn" to="/tasks">+ Add Task</Link>
                  </div>
                ) : null}
              </div>
              {taskList.length ? (
                <div className="dash-add-row">
                  <input
                    aria-label="Quick add task"
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void addTask() }}
                    placeholder="+ Add a task"
                    type="text"
                    value={newTaskTitle}
                  />
                </div>
              ) : null}
            </section>

            <section className="dash-card dash-streak-card">
              <span className="dash-eyebrow flame">{'\uD83D\uDD25'} Study Streak</span>
              <div className="dash-streak-num">
                {streakLoading && !streak ? 'Loading…' : streak > 0 ? `${streak} day streak` : 'Start your streak'}
              </div>
              <p className="dash-streak-sub">
                {streakLoading && !streak
                  ? 'Fetching your latest streak…'
                  : streak > 0
                    ? dashboard?.studied_today
                      ? "You've studied today. Keep it going!"
                      : 'Study 30 minutes today to continue your streak.'
                    : 'Study for 30 minutes today to begin your streak.'}
              </p>
              {dashboard?.next_milestone ? (
                <div className="dash-ms">
                  <span className="dash-ms-label">NEXT MILESTONE: {dashboard.next_milestone.target} DAYS</span>
                  <div className="dash-ms-rail">
                    <span className="dash-ms-cap">{'\uD83D\uDFE0'}</span>
                    <div className="dash-ms-line">
                      <div className="dash-ms-fill" style={{ width: `${Math.min(100, dashboard.next_milestone.progress)}%` }} />
                    </div>
                    <span className="dash-ms-cap">{'\uD83D\uDFE2'}</span>
                  </div>
                  <small className="dash-ms-count">{streak} / {dashboard.next_milestone.target} days</small>
                </div>
              ) : null}
            </section>

            <section className="dash-card dash-exams">
              <div className="dash-head">
                <span className="dash-eyebrow">{'\uD83C\uDF93'} Upcoming Exams</span>
                {dashboard?.upcoming_exams.length ? (
                  <Link className="dash-seeall" to="/exams">See all</Link>
                ) : null}
              </div>
              {dashboard?.upcoming_exams.length ? (
                <div className="dash-exam-list">
                  {dashboard.upcoming_exams.slice(0, 3).map((exam) => (
                    <div key={exam.id} className="dash-exam-row">
                      <div className="dash-exam-main">
                        <strong>{exam.subject_name ?? exam.title}</strong>
                        <small>
                          {exam.subject_name ? `${exam.title} \u00B7 ` : ''}
                          {new Date(exam.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </small>
                      </div>
                      <span className="dash-exam-days">{exam.days_left ?? 0} days</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dash-empty">
                  <p className="dash-empty-title">No upcoming exams</p>
                  <p className="dash-empty-body">Add an exam and Flox will pace your preparation.</p>
                  <Link className="dash-empty-btn" to="/exams">+ Add Exam</Link>
                </div>
              )}
            </section>

            <section className="dash-card dash-ai">
              <span className="dash-eyebrow ai">{'\u2726'} FLOX AI</span>
              <p className="dash-ai-text">{aiInsight.hasData ? aiInsight.text : 'Need help with your studies?'}</p>
              {aiInsight.hasData ? (
                <p className="dash-ai-detail">{aiInsight.detail}</p>
              ) : null}
              <Link className="dash-ai-btn" to="/ai-tutor">Ask FLOX AI {'\u2192'}</Link>
            </section>

            <section
              className="dash-card dash-activity"
              onClick={() => navigate('/progress')}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate('/progress') }}
            >
              <div className="dash-head">
                <span className="dash-eyebrow">{'\uD83D\uDCCA'} Recent Activity</span>
              </div>
              <div className="dash-chart">
                {weekBars.map((bar) => (
                  <div className="dash-bar-col" key={bar.key}>
                    <div className="dash-bar-track">
                      <div
                        className={`dash-bar-fill ${bar.minutes ? '' : 'empty'}`}
                        style={{ height: `${bar.pct}%` }}
                        title={`${formatMinutes(bar.minutes)}`}
                      />
                    </div>
                    <span className="dash-bar-label">{bar.label}</span>
                  </div>
                ))}
              </div>
              <div className="dash-activity-foot">
                <strong>{formatMinutes(dashboard?.week_minutes ?? 0)}</strong>
                <span>this week</span>
                {weekDelta !== null && (
                  <small className={weekDelta >= 0 ? 'up' : 'down'}>
                    {weekDelta >= 0 ? '\u2191' : '\u2193'} {Math.abs(weekDelta)}% vs last week
                  </small>
                )}
              </div>
              {lastSession ? (
                <div className="dash-activity-row">
                  <div className="dash-activity-text">
                    <strong>{lastSession.subject_name ?? 'Study Session'}{lastSession.topic ? ` \u2014 ${lastSession.topic}` : ''}</strong>
                    <small>Last session {timeAgo(lastSession.started_at)}{continueSubjectPct !== null ? ` \u00B7 ${continueSubjectPct}% complete` : ''}</small>
                  </div>
                  <Link className="dash-resume" to="/focus">{'\u23F1\uFE0F'} Resume</Link>
                </div>
              ) : (
                <p className="dash-activity-empty">Complete a focus session to start building momentum.</p>
              )}
            </section>

            <section className="dash-card dash-subjects">
              <div className="dash-head">
                <span className="dash-eyebrow">{'\uD83D\uDCDA'} Subject Progress</span>
                {subjectsSummary.length ? (
                  <Link className="dash-seeall" to="/subjects">View all</Link>
                ) : null}
              </div>
              {subjectsSummary.length ? (
                <div className="dash-subj-list">
                  {subjectsSummary.slice(0, 4).map((sub) => {
                    const pct = sub.total_topics ? Math.round((sub.topics_completed / sub.total_topics) * 100) : 0
                    return (
                      <div key={sub.name} className="dash-subj-row">
                        <div className="dash-subj-head">
                          <span className="dash-subj-dot" style={{ background: sub.color || '#8b5cf6' }} />
                          <strong>{sub.name}</strong>
                          <span>{pct}%</span>
                        </div>
                        <div className="dash-subj-track">
                          <div className="dash-subj-fill" style={{ width: `${pct}%`, background: sub.color || '#8b5cf6' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="dash-empty">
                  <p className="dash-empty-body">Add subjects to track progress.</p>
                  <Link className="dash-empty-btn" to="/subjects">+ Add Subject</Link>
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </PageShell>
  )
} 