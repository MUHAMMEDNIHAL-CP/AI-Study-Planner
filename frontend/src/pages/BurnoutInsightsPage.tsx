import { useMemo, useState, type CSSProperties } from 'react'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'

type BurnoutReport = { score: number; risk_level: string; recommendations: string[] }

type TimetableSlot = {
  id: string
  day: string
  time: string
  subject: string
  topic: string
  duration: number
  type: 'revision' | 'retrieval' | 'wellness' | 'quiz'
  completed: boolean
}

type AdjustResponse = {
  provider?: string
  energy_score: number
  diagnosis: string
  adjusted_timetable: TimetableSlot[]
  changes_made: number
}

const defaultSlots: TimetableSlot[] = [
  { id: 'b1', day: 'Today', time: '09:00', subject: 'Mathematics', topic: 'Timed calculus revision', duration: 60, type: 'revision', completed: false },
  { id: 'b2', day: 'Today', time: '10:20', subject: 'Physics', topic: 'Active recall mechanics', duration: 55, type: 'retrieval', completed: false },
  { id: 'b3', day: 'Today', time: '11:30', subject: 'Chemistry', topic: 'Organic reaction drill', duration: 50, type: 'quiz', completed: false },
]

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function riskTone(score: number) {
  if (score >= 70) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}

export default function BurnoutInsightsPage() {
  const [sleepHours, setSleepHours] = useState('7')
  const [studyHours, setStudyHours] = useState('5')
  const [stress, setStress] = useState(6)
  const [breaks, setBreaks] = useState(2)
  const [fatigue, setFatigue] = useState(5)
  const [productivity, setProductivity] = useState(6)
  const [screenTime, setScreenTime] = useState(5)
  const [missedTasks, setMissedTasks] = useState(1)
  const [report, setReport] = useState<BurnoutReport | null>(null)
  const [adjustment, setAdjustment] = useState<AdjustResponse | null>(null)
  const [slots, setSlots] = useState<TimetableSlot[]>(defaultSlots)
  const [loading, setLoading] = useState(false)

  const energyScore = useMemo(
    () => clamp(100 - fatigue * 7 - screenTime * 3 - missedTasks * 8 + productivity * 4, 5, 100),
    [fatigue, missedTasks, productivity, screenTime],
  )
  const burnoutScore = report?.score ?? clamp(stress * 9 + Math.max(Number(studyHours) - 5, 0) * 8 + Math.max(7 - Number(sleepHours), 0) * 10 - breaks * 4, 0, 100)
  const currentRisk = report?.risk_level ?? riskTone(burnoutScore).toLowerCase()

  async function analyzeBurnout(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const [{ data: burnoutData }, { data: adjustData }] = await Promise.all([
        api.post<BurnoutReport>('/burnout/analyze/', {
          sleep_hours: Number(sleepHours),
          study_hours: Number(studyHours),
          stress,
          breaks,
        }),
        api.post<AdjustResponse>('/study/plan/adjust/', {
          fatigue,
          productivity,
          screen_time: screenTime,
          missed_tasks: missedTasks,
          timetable: slots,
        }),
      ])
      setReport(burnoutData)
      setAdjustment(adjustData)
      setSlots(adjustData.adjusted_timetable)
      toast.success('Burnout insight and timetable adjustment generated')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flow-page burnout-page">
      <section className="page-title burnout-title-row">
        <div>
          <h1>Burnout Insights</h1>
          <p>Scan mental load, diagnose fatigue, and adjust the next timetable before focus collapses.</p>
        </div>
        <b className={`burnout-risk-pill risk-${currentRisk}`}>{currentRisk} risk</b>
      </section>

      <div className="burnout-layout">
        <form className="page-card burnout-scan-card" onSubmit={analyzeBurnout}>
          <div className="section-heading">
            <div>
              <span>Mental load scan</span>
              <h2>Recovery Inputs</h2>
            </div>
          </div>

          <div className="burnout-number-grid">
            <label>Sleep hours<input min="0" max="12" step="0.5" type="number" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} /></label>
            <label>Study hours<input min="0" max="14" step="0.5" type="number" value={studyHours} onChange={(e) => setStudyHours(e.target.value)} /></label>
          </div>

          <div className="burnout-control-stack">
            <BurnoutSlider label="Stress" value={stress} min={1} max={10} onChange={setStress} />
            <BurnoutSlider label="Breaks taken" value={breaks} min={0} max={8} onChange={setBreaks} />
            <BurnoutSlider label="Fatigue" value={fatigue} min={1} max={10} onChange={setFatigue} />
            <BurnoutSlider label="Productivity" value={productivity} min={1} max={10} onChange={setProductivity} />
            <BurnoutSlider label="Screen time" value={screenTime} min={1} max={12} onChange={setScreenTime} suffix="h" />
            <BurnoutSlider label="Missed tasks" value={missedTasks} min={0} max={6} onChange={setMissedTasks} />
          </div>

          <button className="gradient-action" disabled={loading} type="submit">
            {loading ? 'Diagnosing...' : 'Diagnose Fatigue & Adjust'}
          </button>
        </form>

        <aside className="burnout-results-column">
          <section className="page-card burnout-summary-card">
            <div className="burnout-gauges">
              <div className="burnout-gauge" style={{ '--gauge': `${energyScore}%` } as CSSProperties}>
                <strong>{energyScore}</strong>
                <span>Energy</span>
              </div>
              <div className="burnout-gauge risk-gauge" style={{ '--gauge': `${burnoutScore}%` } as CSSProperties}>
                <strong>{burnoutScore}</strong>
                <span>Risk</span>
              </div>
            </div>
            <div className="burnout-summary-text">
              <h2>Recovery Coach</h2>
              <p>{adjustment?.diagnosis ?? 'Run the scan to generate a practical recovery diagnosis and timetable adjustment.'}</p>
            </div>
          </section>

          <section className="page-card burnout-recovery-card">
            <h2>Recovery Plan</h2>
            <div className="burnout-recommendations">
              {(report?.recommendations ?? ['Run a scan to receive recommendations.', 'Use shorter blocks when fatigue is high.', 'Keep one recovery slot before heavy revision.']).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>
        </aside>

        <section className="page-card burnout-timetable-card">
          <div className="section-heading">
            <div>
              <span>{adjustment ? `${adjustment.changes_made} changes made` : 'Preview'}</span>
              <h2>Adjusted Timetable</h2>
            </div>
          </div>
          <div className="burnout-slot-list">
            {slots.map((slot) => (
              <article className={`burnout-slot slot-${slot.type}`} key={slot.id}>
                <time>{slot.time}</time>
                <div>
                  <strong>{slot.subject}</strong>
                  <span>{slot.topic}</span>
                </div>
                <b>{slot.duration}m</b>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function BurnoutSlider({
  label,
  value,
  min,
  max,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="burnout-slider-row">
      <span>
        {label}
        <strong>{value}{suffix}</strong>
      </span>
      <input min={min} max={max} type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}
