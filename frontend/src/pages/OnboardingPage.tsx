import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { IconBot } from '../components/icons'
import { api, getErrorMessage } from '../lib/api'

const GOALS = [2, 3, 4, 5]
const TIMES = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
]

const LEVELS = [
  { value: 'college', label: 'College / University', emoji: '\uD83C\uDF93' },
  { value: 'high_school', label: 'High School', emoji: '\uD83C\uDFEB' },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [level, setLevel] = useState<'college' | 'high_school'>('college')
  const [course, setCourse] = useState('')
  const [grade, setGrade] = useState('')
  const [semester, setSemester] = useState(1)
  const [goal, setGoal] = useState(3)
  const [time, setTime] = useState('morning')
  const [saving, setSaving] = useState(false)

  async function finish() {
    setSaving(true)
    const isCollege = level === 'college'
    try {
      const { data } = await api.get<{ username: string; email: string }>('/auth/me/')
      await api.patch('/auth/me/', {
        username: data.username,
        email: data.email,
        education_level: level,
        course: isCollege ? course.trim() : grade.trim(),
        semester: isCollege ? semester : 1,
        daily_study_goal: goal,
        preferred_study_time: time,
      })
      toast.success("You're all set \u2014 welcome aboard!")
      navigate('/dashboard')
    } catch (err) {
      toast.error(getErrorMessage(err))
      navigate('/dashboard')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="au-page ob-page">
      <section className="au-panel">
        <form
          className="au-card ob-card"
          onSubmit={(e) => { e.preventDefault(); void finish() }}
        >
          <header className="ob-head">
            <span className="au-logo lg"><IconBot size={22} /></span>
            <h2>Welcome to FLOX AI <span className="ob-star">{'\u2726'}</span></h2>
            <p>Let&apos;s personalize your study experience. This takes under a minute.</p>
          </header>

          <div className="ob-question">
            <span className="ob-label">What best describes you?</span>
            <div className="ob-chips">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  className={'ob-chip' + (level === l.value ? ' on' : '')}
                  onClick={() => setLevel(l.value as 'college' | 'high_school')}
                  type="button"
                >
                  {l.emoji} {l.label}
                </button>
              ))}
            </div>
          </div>

          {level === 'college' ? (
            <>
              <div className="ob-question">
                <span className="ob-label">What are you studying?</span>
                <input
                  placeholder="B.Sc Computer Science"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                />
              </div>

              <div className="ob-question">
                <span className="ob-label">What semester?</span>
                <select value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="ob-question">
              <span className="ob-label">What grade or class are you in?</span>
              <input
                placeholder="Grade 10"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </div>
          )}

          <div className="ob-question">
            <span className="ob-label">Daily study goal?</span>
            <div className="ob-chips">
              {GOALS.map((g) => (
                <button
                  key={g}
                  className={'ob-chip' + (goal === g ? ' on' : '')}
                  onClick={() => setGoal(g)}
                  type="button"
                >
                  {g}h
                </button>
              ))}
            </div>
          </div>

          <div className="ob-question">
            <span className="ob-label">When do you usually study?</span>
            <div className="ob-chips">
              {TIMES.map((t) => (
                <button
                  key={t.value}
                  className={'ob-chip' + (time === t.value ? ' on' : '')}
                  onClick={() => setTime(t.value)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button className="au-submit" disabled={saving} type="submit">
            {saving ? 'Setting up...' : 'Continue \u2192'}
          </button>
          <button className="ob-skip" onClick={() => navigate('/dashboard')} type="button">
            Skip for now
          </button>
        </form>
      </section>
    </main>
  )
}
