import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'

type Subject = {
  id: number
  name: string
  color: string
  weekly_goal_hours: number
  weak_topics: string
}

type Exam = {
  id: number
  title: string
  date: string
  priority: string
  subject?: number
  subject_name?: string
}

type Task = {
  id: number
  title: string
  status: string
  priority: string
  due_date?: string
  duration_minutes: number
  subject_name?: string
}

type PlanBlock = {
  time: string
  subject: string
  duration_minutes: number
  task: string
}

type PlanResponse = {
  goal: string
  focus_tip: string
  plan: PlanBlock[]
  revision_schedule: string[]
}

const today = new Date().toISOString().slice(0, 10)

export default function PlannerPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [subjectName, setSubjectName] = useState('')
  const [weakTopics, setWeakTopics] = useState('')
  const [examTitle, setExamTitle] = useState('')
  const [examDate, setExamDate] = useState(today)
  const [taskTitle, setTaskTitle] = useState('')
  const [dailyHours, setDailyHours] = useState('2')
  const [goal, setGoal] = useState('Score higher with calm revision')
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadPlanner() {
    try {
      const [subjectRes, examRes, taskRes] = await Promise.all([
        api.get<Subject[]>('/study/subjects/'),
        api.get<Exam[]>('/study/exams/'),
        api.get<Task[]>('/study/tasks/'),
      ])
      setSubjects(subjectRes.data)
      setExams(examRes.data)
      setTasks(taskRes.data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function loadInitialPlanner() {
      try {
        const [subjectRes, examRes, taskRes] = await Promise.all([
          api.get<Subject[]>('/study/subjects/'),
          api.get<Exam[]>('/study/exams/'),
          api.get<Task[]>('/study/tasks/'),
        ])
        if (!active) return
        setSubjects(subjectRes.data)
        setExams(examRes.data)
        setTasks(taskRes.data)
      } catch (err) {
        if (active) setError(getErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadInitialPlanner()
    return () => {
      active = false
    }
  }, [])

  async function addSubject(event: React.FormEvent) {
    event.preventDefault()
    try {
      await api.post('/study/subjects/', {
        name: subjectName,
        weak_topics: weakTopics,
        weekly_goal_hours: 5,
      })
      setSubjectName('')
      setWeakTopics('')
      toast.success('Subject added')
      await loadPlanner()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function addExam(event: React.FormEvent) {
    event.preventDefault()
    try {
      await api.post('/study/exams/', {
        title: examTitle,
        date: examDate,
        priority: 'high',
        subject: subjects[0]?.id,
      })
      setExamTitle('')
      toast.success('Exam added')
      await loadPlanner()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function addTask(event: React.FormEvent) {
    event.preventDefault()
    try {
      await api.post('/study/tasks/', {
        title: taskTitle,
        due_date: examDate,
        duration_minutes: 45,
        priority: 'medium',
        subject: subjects[0]?.id,
      })
      setTaskTitle('')
      toast.success('Task added')
      await loadPlanner()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function generatePlan(event: React.FormEvent) {
    event.preventDefault()
    try {
      const { data } = await api.post<PlanResponse>('/study/plan/generate/', {
        subjects: subjects.map((subject) => subject.name),
        weak_topics: subjects.map((subject) => subject.weak_topics).filter(Boolean).join(', '),
        daily_hours: dailyHours,
        exam_date: exams[0]?.date ?? examDate,
        goal,
      })
      setPlan(data)
      toast.success('Plan generated')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  if (loading) return <div className="p-6 text-center">Loading planner...</div>

  return (
    <div className="p-6">
      <div className="glass p-6 rounded-lg shadow-glass max-w-6xl mx-auto text-left">
        <h2 className="text-2xl font-semibold">Study Planner</h2>
        <p className="text-sm opacity-80 mt-2">Add study inputs, then generate a practical daily timetable.</p>

        {error ? <div className="mt-4 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</div> : null}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <form className="rounded-lg border border-white/10 bg-white/5 p-4" onSubmit={addSubject}>
            <h3 className="font-semibold">Subject</h3>
            <input className="mt-3 w-full rounded-md px-3 py-2" placeholder="Physics" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required />
            <textarea className="mt-3 min-h-24 w-full rounded-md px-3 py-2" placeholder="Weak topics" value={weakTopics} onChange={(e) => setWeakTopics(e.target.value)} />
            <button className="mt-3 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" type="submit">Add subject</button>
          </form>

          <form className="rounded-lg border border-white/10 bg-white/5 p-4" onSubmit={addExam}>
            <h3 className="font-semibold">Exam</h3>
            <input className="mt-3 w-full rounded-md px-3 py-2" placeholder="Midterm exam" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} required />
            <input className="mt-3 w-full rounded-md px-3 py-2" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
            <button className="mt-3 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white" type="submit">Add exam</button>
          </form>

          <form className="rounded-lg border border-white/10 bg-white/5 p-4" onSubmit={addTask}>
            <h3 className="font-semibold">Task</h3>
            <input className="mt-3 w-full rounded-md px-3 py-2" placeholder="Solve chapter questions" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required />
            <button className="mt-3 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white" type="submit">Add task</button>
          </form>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Subjects</h3>
            <div className="mt-3 space-y-2">
              {subjects.length ? subjects.map((subject) => (
                <div className="rounded-md bg-black/10 p-3" key={subject.id}>
                  <div className="font-medium text-[color:var(--text-h)]">{subject.name}</div>
                  <div className="text-sm opacity-75">{subject.weekly_goal_hours} hrs/week</div>
                </div>
              )) : <p className="text-sm opacity-75">No subjects yet.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Exams</h3>
            <div className="mt-3 space-y-2">
              {exams.length ? exams.map((exam) => (
                <div className="rounded-md bg-black/10 p-3" key={exam.id}>
                  <div className="font-medium text-[color:var(--text-h)]">{exam.title}</div>
                  <div className="text-sm opacity-75">{exam.date} • {exam.subject_name ?? 'General'}</div>
                </div>
              )) : <p className="text-sm opacity-75">No exams yet.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">Tasks</h3>
            <div className="mt-3 space-y-2">
              {tasks.length ? tasks.slice(0, 6).map((task) => (
                <div className="rounded-md bg-black/10 p-3" key={task.id}>
                  <div className="font-medium text-[color:var(--text-h)]">{task.title}</div>
                  <div className="text-sm opacity-75">{task.duration_minutes} min • {task.status}</div>
                </div>
              )) : <p className="text-sm opacity-75">No tasks yet.</p>}
            </div>
          </section>
        </div>

        <form className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4" onSubmit={generatePlan}>
          <h3 className="font-semibold">Generate timetable</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_auto]">
            <input className="rounded-md px-3 py-2" value={goal} onChange={(e) => setGoal(e.target.value)} />
            <input className="rounded-md px-3 py-2" min="0.5" step="0.5" type="number" value={dailyHours} onChange={(e) => setDailyHours(e.target.value)} />
            <button className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white" type="submit">Generate</button>
          </div>
        </form>

        {plan ? (
          <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold">{plan.goal}</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {plan.plan.map((block) => (
                <div className="rounded-md bg-black/10 p-3" key={`${block.time}-${block.subject}`}>
                  <div className="text-sm opacity-70">{block.time} • {block.duration_minutes} min</div>
                  <div className="font-medium text-[color:var(--text-h)]">{block.subject}</div>
                  <div className="text-sm opacity-80">{block.task}</div>
                </div>
              ))}
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
              {plan.revision_schedule.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="mt-4 text-sm text-teal-300">{plan.focus_tip}</p>
          </section>
        ) : null}
      </div>
    </div>
  )
}
