import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'

type BurnoutReport = {
  score: number
  risk_level: string
  recommendations: string[]
}

export default function SettingsPage() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') ?? 'dark')
  const [sleepHours, setSleepHours] = useState('7')
  const [studyHours, setStudyHours] = useState('4')
  const [stress, setStress] = useState('5')
  const [breaks, setBreaks] = useState('2')
  const [report, setReport] = useState<BurnoutReport | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  async function analyzeBurnout(event: React.FormEvent) {
    event.preventDefault()
    try {
      const { data } = await api.post<BurnoutReport>('/burnout/analyze/', {
        sleep_hours: sleepHours,
        study_hours: studyHours,
        stress,
        breaks,
      })
      setReport(data)
      toast.success('Burnout check complete')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="p-6">
      <div className="glass p-6 rounded-lg shadow-glass max-w-4xl mx-auto text-left">
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm opacity-80 mt-2">Theme preferences and recovery checks.</p>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold">Theme</h3>
          <div className="mt-3 flex gap-2">
            {['dark', 'light'].map((item) => (
              <button
                className={`rounded-md px-4 py-2 text-sm font-medium ${theme === item ? 'bg-blue-600 text-white' : 'border border-white/15'}`}
                key={item}
                onClick={() => setTheme(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <form className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4" onSubmit={analyzeBurnout}>
          <h3 className="font-semibold">Burnout check</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input className="rounded-md px-3 py-2" min="0" step="0.5" type="number" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="Sleep hours" />
            <input className="rounded-md px-3 py-2" min="0" step="0.5" type="number" value={studyHours} onChange={(e) => setStudyHours(e.target.value)} placeholder="Study hours" />
            <input className="rounded-md px-3 py-2" max="10" min="1" type="number" value={stress} onChange={(e) => setStress(e.target.value)} placeholder="Stress 1-10" />
            <input className="rounded-md px-3 py-2" min="0" type="number" value={breaks} onChange={(e) => setBreaks(e.target.value)} placeholder="Breaks" />
          </div>
          <button className="mt-3 rounded-md bg-teal-600 px-4 py-2 font-medium text-white" type="submit">Analyze</button>
        </form>

        {report ? (
          <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-sm uppercase opacity-65">Risk: {report.risk_level}</div>
            <div className="mt-2 text-3xl font-semibold text-[color:var(--text-h)]">{report.score}/100</div>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
              {report.recommendations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
