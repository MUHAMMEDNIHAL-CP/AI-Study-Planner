import { useCallback, useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import PageShell from '../components/PageShell'
import SetupStepper from '../components/SetupStepper'
import { IconFocus, IconOrbit, IconPlanner, IconSpark } from '../components/icons'
import { api, getErrorMessage } from '../lib/api'

type Subject = { id: number; name: string; weekly_goal_hours: number; weak_topics: string }
type Exam = { id: number; title: string; date: string; priority: string; subject_name?: string }
type Task = {
  id: number
  title: string
  status: string
  duration_minutes: number
  subject_name?: string
  due_date?: string
  priority?: string
}
type PlanBlock = { time: string; subject: string; duration_minutes: number | string; task: string }
type PlanResponse = {
  provider?: string
  goal: string
  focus_tip: string
  plan: PlanBlock[]
  revision_schedule: string[]
}

function toLocalDateInput(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const today = toLocalDateInput()

function monthCells(exams: Exam[]) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const first = new Date(year, month, 1)
  const totalDays = new Date(year, month + 1, 0).getDate()
  const blanks = first.getDay()
  const examDays = new Set(
    exams
      .map((exam) => new Date(exam.date))
      .filter((date) => date.getFullYear() === year && date.getMonth() === month)
      .map((date) => date.getDate()),
  )

  return {
    label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    cells: [...Array.from({ length: blanks }, () => null), ...Array.from({ length: totalDays }, (_, index) => index + 1)],
    todayDate: now.getDate(),
    examDays,
  }
}

function scrollToWizard(id: string) {
  const node = document.getElementById(id)
  if (!node) return
  node.classList.add('highlight')
  node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  window.setTimeout(() => node.classList.remove('highlight'), 1400)
}

function daysUntil(dateString: string) {
  const target = new Date(`${dateString}T00:00:00`)
  const start = new Date(`${today}T00:00:00`)
  return Math.max(0, Math.ceil((target.getTime() - start.getTime()) / 86_400_000))
}

function shortDate(dateString?: string) {
  if (!dateString) return 'No due date'
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function minutesLabel(minutes: number | string) {
  const numeric = Number(minutes)
  if (!Number.isFinite(numeric)) return `${minutes} min`
  if (numeric >= 60) return `${Math.floor(numeric / 60)}h ${numeric % 60 ? `${numeric % 60}m` : ''}`.trim()
  return `${numeric} min`
}

function priorityTone(priority?: string) {
  if (priority === 'high') return 'High'
  if (priority === 'low') return 'Light'
  return 'Medium'
}

function urgencyText(exam?: Exam) {
  if (!exam) return 'Waiting for target'
  const days = daysUntil(exam.date)
  if (days <= 2) return 'Final push'
  if (days <= 7) return 'High priority'
  if (days <= 21) return 'Build momentum'
  return 'Long range'
}

function urgencyClass(exam: Exam) {
  const days = daysUntil(exam.date)
  if (days <= 2) return 'critical'
  if (days <= 7) return 'soon'
  if (days <= 21) return 'steady'
  return 'calm'
}

export default function PlannerPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [subjectName, setSubjectName] = useState('')
  const [weakTopics, setWeakTopics] = useState('')
  const [examTitle, setExamTitle] = useState('')
  const [examDate, setExamDate] = useState(today)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [dailyHours, setDailyHours] = useState('3')
  const [goal, setGoal] = useState('Deep work revision sprint')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [provider, setProvider] = useState('checking')
  const [loading, setLoading] = useState(true)
  const [planLoading, setPlanLoading] = useState(false)

  const activeSubject = subjects.find((subject) => String(subject.id) === selectedSubjectId)
  const calendar = useMemo(() => monthCells(exams), [exams])
  const weakTopicText = subjects.map((subject) => subject.weak_topics).filter(Boolean).join(', ')
  const upcomingExams = useMemo(
    () => [...exams].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5),
    [exams],
  )
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'done'), [tasks])
  const sortedTasks = useMemo(
    () => [...tasks]
      .sort((a, b) => {
        const statusOrder = Number(a.status === 'done') - Number(b.status === 'done')
        if (statusOrder !== 0) return statusOrder
        return new Date(a.due_date || today).getTime() - new Date(b.due_date || today).getTime()
      }),
    [tasks],
  )
  const completedTasks = tasks.length - openTasks.length
  const taskProgress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0
  const totalStudyMinutes = tasks.reduce((sum, task) => sum + Number(task.duration_minutes || 0), 0)
  const nextExam = upcomingExams[0]
  const planBlocks = plan?.plan ?? []
  const readiness = Math.round(
    ((subjects.length ? 1 : 0) + (exams.length ? 1 : 0) + (tasks.length ? 1 : 0) + (plan ? 1 : 0)) * 25,
  )
  const nextPlannerAction = !subjects.length
    ? { label: 'Add first subject', target: 'wizard-subjects' }
    : !exams.length
      ? { label: 'Add exam date', target: 'wizard-exams' }
      : !plan
        ? { label: 'Create timetable', target: 'wizard-plan' }
        : { label: 'Review timetable', target: 'wizard-plan' }
  const hourPresets = [
    { label: 'Light', value: '1.5', detail: 'low stress' },
    { label: 'Balanced', value: '3', detail: 'daily flow' },
    { label: 'Sprint', value: '5', detail: 'exam mode' },
  ]

  const setupSteps = useMemo(() => {
    const hasSubjects = subjects.length > 0
    const hasExams = exams.length > 0
    const hasPlan = Boolean(plan)
    return [
      {
        id: 'wizard-subjects',
        label: 'Step 1',
        title: 'Subject map',
        detail: hasSubjects ? `${subjects.length} subject${subjects.length === 1 ? '' : 's'} ready` : 'Add weak topics first',
        done: hasSubjects,
        active: !hasSubjects,
      },
      {
        id: 'wizard-exams',
        label: 'Step 2',
        title: 'Exam target',
        detail: hasExams ? `${exams.length} exam${exams.length === 1 ? '' : 's'} tracked` : 'Set your nearest deadline',
        done: hasExams,
        active: hasSubjects && !hasExams,
      },
      {
        id: 'wizard-plan',
        label: 'Step 3',
        title: 'AI timetable',
        detail: hasPlan ? 'Plan generated' : 'Create a daily flow',
        done: hasPlan,
        active: hasSubjects && hasExams && !hasPlan,
      },
    ]
  }, [exams.length, plan, subjects.length])

  const loadPlanner = useCallback(async () => {
    const [subjectRes, examRes, taskRes] = await Promise.all([
      api.get<Subject[]>('/study/subjects/'),
      api.get<Exam[]>('/study/exams/'),
      api.get<Task[]>('/study/tasks/'),
    ])
    setSubjects(subjectRes.data)
    setExams(examRes.data)
    setTasks(taskRes.data)
    setSelectedSubjectId((current) => current || (subjectRes.data[0] ? String(subjectRes.data[0].id) : ''))
  }, [])

  useEffect(() => {
    let active = true

    async function loadInitialPlanner() {
      try {
        const [statusRes] = await Promise.all([api.get<{ provider: string }>('/ai/status/'), loadPlanner()])
        if (active) setProvider(statusRes.data.provider)
      } catch (err) {
        if (active) toast.error(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadInitialPlanner()
    return () => {
      active = false
    }
  }, [loadPlanner])

  async function addSubject(event: FormEvent) {
    event.preventDefault()
    try {
      const { data } = await api.post<Subject>('/study/subjects/', {
        name: subjectName.trim(),
        weak_topics: weakTopics.trim(),
        weekly_goal_hours: 5,
      })
      setSubjectName('')
      setWeakTopics('')
      setSelectedSubjectId(String(data.id))
      toast.success('Subject added')
      await loadPlanner()
      scrollToWizard('wizard-exams')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function deleteSubject(subjectId: number) {
    try {
      await api.delete(`/study/subjects/${subjectId}/`)
      if (selectedSubjectId === String(subjectId)) setSelectedSubjectId('')
      toast.success('Subject removed')
      await loadPlanner()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function addExam(event: FormEvent) {
    event.preventDefault()
    try {
      await api.post('/study/exams/', {
        title: examTitle.trim(),
        date: examDate,
        priority: 'high',
        subject: selectedSubjectId ? Number(selectedSubjectId) : null,
      })
      setExamTitle('')
      toast.success('Exam added')
      await loadPlanner()
      scrollToWizard('wizard-plan')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault()
    try {
      await api.post('/study/tasks/', {
        title: taskTitle.trim(),
        due_date: examDate,
        duration_minutes: 45,
        priority: taskPriority,
        subject: selectedSubjectId ? Number(selectedSubjectId) : null,
      })
      setTaskTitle('')
      setTaskPriority('medium')
      toast.success('Task added')
      await loadPlanner()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function deleteExam(examId: number) {
    try {
      await api.delete(`/study/exams/${examId}/`)
      toast.success('Exam removed')
      await loadPlanner()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function deleteTask(taskId: number) {
    try {
      await api.delete(`/study/tasks/${taskId}/`)
      toast.success('Task removed')
      await loadPlanner()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function toggleTask(task: Task) {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item)))
    try {
      await api.patch(`/study/tasks/${task.id}/`, { status: nextStatus })
    } catch (err) {
      toast.error(getErrorMessage(err))
      await loadPlanner()
    }
  }

  async function generatePlan(event?: FormEvent | MouseEvent) {
    event?.preventDefault()
    setPlanLoading(true)
    try {
      const { data } = await api.post<PlanResponse>('/study/plan/generate/', {
        subjects: subjects.length ? subjects.map((subject) => subject.name) : [activeSubject?.name ?? 'Core Study'],
        weak_topics: weakTopicText || activeSubject?.weak_topics || 'priority weak topics',
        daily_hours: dailyHours,
        exam_date: nextExam?.date ?? examDate,
        goal,
      })
      setPlan(data)
      setProvider(data.provider ?? provider)
      toast.success(`${data.provider === 'gemini' ? 'Gemini' : 'AI'} timetable generated`)
      scrollToWizard('wizard-plan')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPlanLoading(false)
    }
  }

  if (loading) {
    return (
      <PageShell eyebrow="Study planner" title="Loading your planner..." subtitle="Fetching subjects, exams, and tasks.">
        <div className="page-card planner-skeleton">Loading planner workspace...</div>
      </PageShell>
    )
  }

  return (
    <PageShell
      badge={<b className={`provider-pill provider-${provider}`}>{provider}</b>}
      className="planner-flow-page"
      eyebrow="Study planner"
      subtitle="Turn weak topics, exam dates, and daily limits into a calm schedule you can actually follow."
      title="Design today's study flow"
    >
      <SetupStepper onStepClick={scrollToWizard} steps={setupSteps} />

      <section className="planner-command-center">
        <div className="planner-hero-card">
          <div>
            <span className="eyebrow">Next deadline</span>
            <h2>{nextExam ? nextExam.title : 'No exam added yet'}</h2>
            <p>
              {nextExam
                ? `${nextExam.subject_name || 'General study'} is ${daysUntil(nextExam.date)} days away.`
                : 'Add one exam target so FocusFlow can shape the timetable around a real date.'}
            </p>
            <div className="planner-hero-actions">
              <button onClick={() => scrollToWizard(nextPlannerAction.target)} type="button">
                <IconOrbit size={18} /> {nextPlannerAction.label}
              </button>
              <Link to="/focus"><IconFocus size={18} /> Start focus mode</Link>
            </div>
          </div>
          <div className="planner-countdown-orb">
            <strong>{nextExam ? daysUntil(nextExam.date) : '--'}</strong>
            <span>days</span>
          </div>
        </div>

        <div className="planner-side-summary">
          <div className="planner-metric-strip">
            <article>
              <span>Subjects</span>
              <strong>{subjects.length}</strong>
            </article>
            <article>
              <span>Open Tasks</span>
              <strong>{openTasks.length}</strong>
            </article>
            <article>
              <span>Planned Load</span>
              <strong>{minutesLabel(totalStudyMinutes)}</strong>
            </article>
            <article>
              <span>Completion</span>
              <strong>{taskProgress}%</strong>
            </article>
          </div>
          <article className="planner-readiness-card">
            <div>
              <IconSpark size={20} />
              <span>Planner readiness</span>
            </div>
            <strong>{readiness}%</strong>
            <div className="planner-readiness-track"><i style={{ width: `${readiness}%` }} /></div>
            <p>{plan ? 'Your plan is ready. Check off tasks as you study.' : 'Add subject, exam, and one task for the cleanest AI timetable.'}</p>
          </article>
        </div>
      </section>

      <div className="planner-workspace-grid">
        <section className="page-card planner-builder-card" id="wizard-subjects">
          <div className="planner-section-head">
            <div>
              <span className="eyebrow">Planner input</span>
              <h2>Flow Builder</h2>
              <p>Add the study ingredients once, then let AI arrange the day.</p>
            </div>
            <button className="gradient-action" disabled={planLoading} onClick={() => void generatePlan()} type="button">
              <IconSpark size={18} /> {planLoading ? 'Generating...' : 'Generate AI Plan'}
            </button>
          </div>

          <div className="planner-builder-grid">
            <form className="planner-mini-form" onSubmit={addSubject}>
              <h3>Subject and weak topic</h3>
              <label>
                <span>Subject name</span>
                <input placeholder="Organic Chemistry" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} required />
              </label>
              <label>
                <span>Weak topics</span>
                <textarea placeholder="Alcohols, reaction mechanisms, equations" value={weakTopics} onChange={(event) => setWeakTopics(event.target.value)} />
              </label>
              <button type="submit">Add Subject</button>
            </form>

            <form className="planner-mini-form" id="wizard-exams" onSubmit={addExam}>
              <h3>Exam target</h3>
              <label>
                <span>Subject</span>
                <select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}>
                  <option value="">No subject</option>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </label>
              <label>
                <span>Exam title</span>
                <input placeholder="Midterm exam" value={examTitle} onChange={(event) => setExamTitle(event.target.value)} required />
              </label>
              <label>
                <span>Exam date</span>
                <input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
              </label>
              <button type="submit">Add Exam</button>
            </form>

            <form className="planner-mini-form" onSubmit={addTask}>
              <h3>Daily action</h3>
              <label>
                <span>Subject</span>
                <select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}>
                  <option value="">No subject</option>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </label>
              <label>
                <span>Task</span>
                <input placeholder="Solve 20 active recall questions" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} required />
              </label>
              <label>
                <span>Priority</span>
                <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <button type="submit">Add Task</button>
            </form>
          </div>
        </section>

        <aside className="planner-side-rail">
          <section className="page-card planner-calendar-card">
            <div className="planner-section-head compact">
              <div>
                <span className="eyebrow">Calendar</span>
                <h2>{calendar.label}</h2>
              </div>
              <b className="planner-urgency-pill">{urgencyText(nextExam)}</b>
            </div>
            <div className="calendar-week"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
            <div className="calendar-grid planner-calendar-grid">
              {calendar.cells.map((day, index) => (
                <button
                  className={day === calendar.todayDate ? 'calendar-active' : day && calendar.examDays.has(day) ? 'calendar-dot-day' : ''}
                  disabled={!day}
                  key={`${day ?? 'blank'}-${index}`}
                  title={day && calendar.examDays.has(day) ? 'Exam day' : undefined}
                  type="button"
                >
                  {day ?? ''}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="planner-live-grid">
        <div className="page-card planner-subject-deck">
          <div className="planner-section-head compact">
            <div>
              <span className="eyebrow">Subject deck</span>
              <h2>Weak topics to attack</h2>
            </div>
          </div>
          <div className="planner-subject-list">
            {subjects.length ? subjects.map((subject, index) => (
              <article className={String(subject.id) === selectedSubjectId ? 'selected' : ''} key={subject.id}>
                <button aria-label={`Select ${subject.name}`} onClick={() => setSelectedSubjectId(String(subject.id))} type="button">
                  <b>{subject.name.slice(0, 2).toUpperCase()}</b>
                  <span>
                    <strong>{subject.name}</strong>
                    <small>{subject.weak_topics || 'No weak topics yet'}</small>
                  </span>
                </button>
                <div className="subject-progress"><i style={{ width: `${Math.min(48 + index * 11, 92)}%` }} /></div>
                <footer>
                  <span>{subject.weekly_goal_hours}h weekly goal</span>
                  <div>
                    <Link to="/quiz">Quiz</Link>
                    <button className="subject-delete-button" onClick={() => void deleteSubject(subject.id)} type="button">Remove</button>
                  </div>
                </footer>
              </article>
            )) : (
              <div className="planner-empty-state">Add your first subject to unlock the weak-topic deck.</div>
            )}
          </div>
        </div>

        <div className="page-card planner-timeline-card">
          <div className="planner-section-head compact">
            <div>
              <span className="eyebrow">Exam runway</span>
              <h2>Countdown path</h2>
            </div>
          </div>
          <div className="planner-exam-list">
            {upcomingExams.length ? upcomingExams.map((exam, index) => (
              <article className={`urgency-${urgencyClass(exam)}`} key={exam.id}>
                <div className="planner-exam-marker">
                  <span>{index + 1}</span>
                </div>
                <div>
                  <div className="planner-exam-title-line">
                    <strong>{exam.title}</strong>
                    <b>{daysUntil(exam.date)}d</b>
                  </div>
                  <span>{exam.subject_name || 'General study'} - {shortDate(exam.date)}</span>
                  <div className="planner-exam-meter">
                    <i style={{ width: `${Math.max(8, Math.min(100, 100 - daysUntil(exam.date) * 3))}%` }} />
                  </div>
                </div>
                <button className="planner-remove-button" onClick={() => void deleteExam(exam.id)} type="button">
                  Remove
                </button>
              </article>
            )) : <div className="planner-empty-state">No exam deadline yet. Add one above to activate countdown planning.</div>}
          </div>
        </div>

        <div className="page-card planner-task-card">
          <div className="planner-section-head compact">
            <div>
              <span className="eyebrow">Today queue</span>
              <h2>Active recall board</h2>
            </div>
            <strong className="planner-progress-pill">{taskProgress}% done</strong>
          </div>
          <div className="planner-task-summary">
            <span>{openTasks.length} open</span>
            <span>{completedTasks} completed</span>
          </div>
          <div className="planner-task-list">
            {sortedTasks.length ? sortedTasks.slice(0, 7).map((task) => (
              <article className={task.status === 'done' ? 'done' : ''} key={task.id}>
                <button
                  aria-label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`}
                  className={task.status === 'done' ? 'planner-task-check checked' : 'planner-task-check'}
                  onClick={() => void toggleTask(task)}
                  type="button"
                />
                <div>
                  <div className="planner-task-title-line">
                    <strong>{task.title}</strong>
                  </div>
                  <span>{task.subject_name || 'Study'} - due {shortDate(task.due_date)}</span>
                </div>
                <div className="planner-task-actions">
                  <em>{priorityTone(task.priority)}</em>
                  <button className="planner-remove-button" onClick={() => void deleteTask(task.id)} type="button">
                    Remove
                  </button>
                </div>
              </article>
            )) : <div className="planner-empty-state">Add one concrete task, then check it off as you study.</div>}
          </div>
        </div>
      </section>

      <form className="page-card planner-ai-board" id="wizard-plan" onSubmit={generatePlan}>
        <div className="planner-section-head">
          <div>
            <span className="eyebrow">AI timetable</span>
            <h2>Generated study flow</h2>
            <p>Gemini creates focused blocks from your subjects, weak topics, daily hours, and nearest exam.</p>
          </div>
          <button className="gradient-action" disabled={planLoading} type="submit">
            <IconPlanner size={18} /> {planLoading ? 'Generating...' : plan ? 'Regenerate' : 'Create Timetable'}
          </button>
        </div>

        <div className="planner-ai-controls">
          <label>
            <span>Study goal</span>
            <input placeholder="Study goal" value={goal} onChange={(event) => setGoal(event.target.value)} />
          </label>
          <label>
            <span>Daily hours</span>
            <input min="0.5" step="0.5" type="number" value={dailyHours} onChange={(event) => setDailyHours(event.target.value)} />
          </label>
          <div className="planner-hour-presets" aria-label="Study hour presets">
            {hourPresets.map((preset) => (
              <button
                className={dailyHours === preset.value ? 'active' : ''}
                key={preset.value}
                onClick={() => setDailyHours(preset.value)}
                type="button"
              >
                <strong>{preset.label}</strong>
                <span>{preset.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="planner-plan-grid">
          {(planBlocks.length ? planBlocks : openTasks.slice(0, 4).map((task, index) => ({
            time: `Block ${index + 1}`,
            subject: task.subject_name ?? 'Study',
            duration_minutes: task.duration_minutes,
            task: task.title,
          }))).map((block, index) => (
            <article className="planner-plan-card" key={`${block.time}-${block.task}-${index}`}>
              <span className="planner-plan-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="planner-plan-time">
                <span>{block.time}</span>
                <b>{minutesLabel(block.duration_minutes)}</b>
              </div>
              <div>
                <strong>{block.subject}</strong>
                <p>{block.task}</p>
              </div>
            </article>
          ))}
          {!planBlocks.length && !openTasks.length ? (
            <div className="planner-empty-state wide">Your generated timetable will appear here after steps 1 and 2.</div>
          ) : null}
        </div>

        {plan ? (
          <div className="planner-revision-map">
            <div>
              <h3>Revision Map</h3>
              <strong>{plan.focus_tip}</strong>
            </div>
            <div className="planner-revision-list">
              {plan.revision_schedule.map((item, index) => (
                <p key={`${item}-${index}`}><b>{index + 1}</b>{item}</p>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </PageShell>
  )
}
