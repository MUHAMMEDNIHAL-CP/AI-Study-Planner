import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'

type Subject = { id: number; name: string; color?: string }
type FocusSession = { id: number; subject_name?: string; topic?: string; duration_minutes: number; started_at: string; mood?: string }
type NoteLite = { id: number; title: string; content: string }

type Phase = 'setup' | 'running' | 'paused' | 'break' | 'complete'

type SoundId = 'none' | 'rain' | 'brown' | 'white' | 'lofi'

const DURATIONS = [
  { label: '25 min', seconds: 25 * 60 },
  { label: '50 min', seconds: 50 * 60 },
  { label: '90 min', seconds: 90 * 60 },
]

const MOODS = [
  { emoji: '😫', value: 'difficult', label: 'Difficult' },
  { emoji: '😐', value: 'okay', label: 'Okay' },
  { emoji: '🙂', value: 'good', label: 'Good' },
  { emoji: '🔥', value: 'excellent', label: 'Excellent' },
] as const

const SOUNDS: Array<{ id: SoundId; label: string }> = [
  { id: 'none', label: 'Off' },
  { id: 'rain', label: 'Rain' },
  { id: 'brown', label: 'Brown Noise' },
  { id: 'white', label: 'White Noise' },
  { id: 'lofi', label: 'Lo-fi' },
]

const SETTINGS_KEY = 'focusflow.focus.settings.v1'

type PersistedSettings = {
  durationIdx: number
  customMin: string
  sound: SoundId
  autoBreak: boolean
  confirmEnd: boolean
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...{ durationIdx: 1, customMin: '', sound: 'none' as SoundId, autoBreak: true, confirmEnd: true }, ...(JSON.parse(raw) as Partial<PersistedSettings>) }
  } catch { /* ignore */ }
  return { durationIdx: 1, customMin: '', sound: 'none', autoBreak: true, confirmEnd: true }
}

function pad2(n: number) { return n < 10 ? '0' + n : '' + n }

function clock(s: number) {
  const m = Math.floor(s / 60)
  return pad2(m) + ':' + pad2(s % 60)
}

function htmlStrip(html: string) {
  return html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
}

export default function FocusModePage() {
  const initial = useMemo(loadSettings, [])

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sessions, setSessions] = useState<FocusSession[]>([])

  const [phase, setPhase] = useState<Phase>('setup')
  const [subjectId, setSubjectId] = useState('')
  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('')
  const [durationIdx, setDurationIdx] = useState(initial.durationIdx)
  const [customMin, setCustomMin] = useState(initial.customMin)
  const [sound, setSound] = useState<SoundId>(initial.sound)
  const [autoBreak, setAutoBreak] = useState(initial.autoBreak)
  const [confirmEnd, setConfirmEnd] = useState(initial.confirmEnd)

  const [totalSeconds, setTotalSeconds] = useState(DURATIONS[initial.durationIdx]?.seconds ?? 50 * 60)
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const [breakLeft, setBreakLeft] = useState(5 * 60)
  const [pauseCount, setPauseCount] = useState(0)

  const secondsLeftRef = useRef(secondsLeft)
  useEffect(() => { secondsLeftRef.current = secondsLeft }, [secondsLeft])

  const [mood, setMood] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [uiVisible, setUiVisible] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [studyOpen, setStudyOpen] = useState(false)
  const [notes, setNotes] = useState<NoteLite[] | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'you' | 'ai'; text: string }>>([])
  const [aiInput, setAiInput] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const breakTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const soundSourceRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [subRes, sessRes] = await Promise.all([
          api.get<Subject[]>('/study/subjects/'),
          api.get<FocusSession[]>('/productivity/focus-sessions/').catch(() => ({ data: [] as FocusSession[] })),
        ])
        if (!active) return
        setSubjects(subRes.data)
        setSessions(sessRes.data)
      } catch (err) { if (active) toast.error(getErrorMessage(err)) }
    }
    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ durationIdx, customMin, sound, autoBreak, confirmEnd }))
  }, [durationIdx, customMin, sound, autoBreak, confirmEnd])

  const immersive = phase !== 'setup'

  useEffect(() => {
    document.body.classList.toggle('fm-immersive', immersive)
    return () => { document.body.classList.remove('fm-immersive') }
  }, [immersive])

  const subject = useMemo(() => subjects.find((s) => String(s.id) === subjectId), [subjects, subjectId])
  const subjectName = subject?.name ?? ''
  const subjectColor = subject?.color ?? '#ff8a5c'
  const progress = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0

  const plannedSeconds = Number(customMin) > 0 ? Number(customMin) * 60 : DURATIONS[durationIdx].seconds

  const todayKeyStr = new Date().toISOString().slice(0, 10)

  const streak = useMemo(() => {
    let count = 0
    const d = new Date()
    while (true) {
      const ds = d.toISOString().slice(0, 10)
      const had = sessions.some((s) => s.started_at?.slice(0, 10) === ds && s.duration_minutes >= 20)
      if (!had) break
      count++
      d.setDate(d.getDate() - 1)
      if (ds === todayKeyStr) continue
    }
    return count
  }, [sessions, todayKeyStr])

  const todayDone = useMemo(
    () => sessions.filter((s) => s.started_at?.slice(0, 10) === todayKeyStr && s.duration_minutes >= 20).length,
    [sessions, todayKeyStr],
  )
  const streakDelta = todayDone > 0 ? 0 : 1

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (phase !== 'running') return
    tickRef.current = setInterval(() => {
      setSecondsLeft((p) => {
        if (p <= 1) {
          playChime()
          setPhase(autoBreak ? 'break' : 'complete')
          setBreakLeft(5 * 60)
          return 0
        }
        return p - 1
      })
    }, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [phase, autoBreak])

  useEffect(() => {
    if (breakTickRef.current) clearInterval(breakTickRef.current)
    if (phase !== 'break') return
    breakTickRef.current = setInterval(() => {
      setBreakLeft((p) => {
        if (p <= 1) { setPhase('complete'); return 0 }
        return p - 1
      })
    }, 1000)
    return () => { if (breakTickRef.current) clearInterval(breakTickRef.current) }
  }, [phase])

  useEffect(() => {
    if ((phase === 'running' || phase === 'paused') && sound !== 'none') startAmbience(sound)
    else stopAmbience()
    return stopAmbience
  }, [phase, sound])

  useEffect(() => {
    if (phase !== 'running') { setUiVisible(true); return }
    const t = setTimeout(() => setUiVisible(false), 3200)
    return () => clearTimeout(t)
  }, [phase, uiVisible])

  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') {
      document.title = 'FocusFlow AI'
      return
    }
    const base = 'FocusFlow AI — Focus'
    const id = setInterval(() => {
      document.title = clock(secondsLeftRef.current) + ' · ' + base
    }, 1000)
    document.title = clock(secondsLeft) + ' · ' + base
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [phase])

  const playChime = useCallback(() => {
    try {
      const ctx = audioRef.current ??= new AudioContext()
      ;[880, 1108].forEach((freq, i) => {
        setTimeout(() => {
          const o = ctx.createOscillator(); const g = ctx.createGain()
          o.frequency.value = freq; g.gain.value = 0.06; o.connect(g); g.connect(ctx.destination)
          o.start(); o.stop(ctx.currentTime + 0.25)
        }, i * 160)
      })
    } catch { /* no audio */ }
  }, [])

  const stopAmbience = useCallback(() => {
    soundSourceRef.current?.stop()
    soundSourceRef.current = null
  }, [])

  const startAmbience = useCallback((id: SoundId) => {
    stopAmbience()
    if (id === 'none') return
    try {
      const ctx = audioRef.current ??= new AudioContext()
      if (ctx.state === 'suspended') void ctx.resume()
      if (id === 'lofi') {
        const g = ctx.createGain(); g.gain.value = 0.035
        const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 174.6
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 261.6
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.015
        lfo.connect(lfoGain); lfoGain.connect(g.gain)
        o1.connect(g); o2.connect(g); g.connect(ctx.destination)
        o1.start(); o2.start(); lfo.start()
        soundSourceRef.current = { stop: () => { o1.stop(); o2.stop(); lfo.stop() } }
        return
      }
      const bufSize = ctx.sampleRate * 3
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = buf.getChannelData(0)
      if (id === 'brown') {
        let last = 0
        for (let i = 0; i < bufSize; i++) {
          const w = Math.random() * 2 - 1
          last = (last + 0.02 * w) / 1.02
          data[i] = last * 3.2
        }
      } else {
        const amp = id === 'rain' ? 0.28 : 0.55
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * amp
      }
      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true
      const g = ctx.createGain(); g.gain.value = id === 'rain' ? 0.09 : id === 'brown' ? 0.12 : 0.05
      src.connect(g); g.connect(ctx.destination); src.start()
      soundSourceRef.current = { stop: () => src.stop() }
    } catch { /* no audio */ }
  }, [stopAmbience])

  function startSession() {
    const secs = Number(customMin) > 0 ? Number(customMin) * 60 : DURATIONS[durationIdx].seconds
    setTotalSeconds(secs)
    setSecondsLeft(secs)
    setPauseCount(0)
    setMood('')
    setReviewNote('')
    setAiMessages([])
    setUiVisible(true)
    setPhase('running')
  }

  function pauseSession() { setPauseCount((p) => p + 1); setPhase('paused'); setUiVisible(true) }
  function resumeSession() { setPhase('running') }

  function requestEnd() {
    const elapsed = totalSeconds - secondsLeft
    if (elapsed >= 60 && confirmEnd) { setConfirmOpen(true); return }
    if (elapsed >= 60) { setPhase('complete'); return }
    discardSession()
  }

  function discardSession() {
    setConfirmOpen(false)
    stopAmbience()
    setPhase('setup')
    setSecondsLeft(totalSeconds)
    setMood('')
    setReviewNote('')
  }

  function skipBreak() { setPhase('complete') }

  const completedMinutes = Math.max(1, Math.round((totalSeconds - secondsLeft) / 60))
  const focusScore = Math.max(58, Math.min(99, Math.round(100 - pauseCount * 4)))

  async function openStudy() {
    setStudyOpen(true)
    if (notes === null) {
      try {
        const { data } = await api.get<NoteLite[]>('/notes/')
        setNotes(data)
      } catch { setNotes([]) }
    }
  }

  const studyMatches = useMemo(() => {
    if (!notes) return []
    const q = (topic + ' ' + subjectName).toLowerCase().trim()
    const terms = q.split(/\s+/).filter((w) => w.length > 2)
    const scored = notes.map((n) => {
      const hay = (n.title + ' ' + htmlStrip(n.content)).toLowerCase()
      const hits = terms.filter((t) => hay.includes(t)).length
      return { n, hits }
    })
    const matched = scored.filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits).map((s) => s.n)
    const rest = scored.filter((s) => s.hits === 0).map((s) => s.n)
    return [...matched, ...rest].slice(0, 5)
  }, [notes, topic, subjectName])

  async function askAi(prompt: string) {
    const text = prompt.trim()
    if (!text || aiBusy) return
    setAiMessages((prev) => [...prev, { role: 'you', text }])
    setAiInput('')
    setAiBusy(true)
    try {
      const { data } = await api.post<{ reply: string }>('/ai/chat/', {
        message: text,
        context: { page: '/focus', mode: 'focus-help', subject: subjectName, topic },
      })
      setAiMessages((prev) => [...prev, { role: 'ai', text: data.reply }])
    } catch (err) {
      setAiMessages((prev) => [...prev, { role: 'ai', text: 'I could not connect right now. Your timer is still running — try again in a moment.' }])
      toast.error(getErrorMessage(err))
    } finally {
      setAiBusy(false)
    }
  }

  async function finishSession() {
    setSaving(true)
    try {
      await api.post('/productivity/focus-sessions/', {
        subject: subjectId ? Number(subjectId) : null,
        duration_minutes: completedMinutes,
        completed: true,
        mood: mood || undefined,
        topic: topic || undefined,
        notes: reviewNote || 'Focus session',
        date: new Date().toISOString().slice(0, 10),
      })
      const { data } = await api.get<FocusSession[]>('/productivity/focus-sessions/')
      setSessions(data)
      toast.success('📊 Progress updated — great work!')
      stopAmbience()
      setPhase('setup')
      setSecondsLeft(plannedSeconds)
      setGoal('')
      setMood('')
      setReviewNote('')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const setup = (
    <div className="fm-setup">
      <header className="fm-top">
        <Link to="/dashboard" className="fm-setup-back">{'\u2190'} Dashboard</Link>
        <div className="fm-top-right">
          <span className="fm-streak-pill">{'\uD83D\uDD25'} {streak} day{streak !== 1 ? 's' : ''}</span>
          <button className={'fm-kebab' + (settingsOpen ? ' open' : '')} onClick={() => setSettingsOpen((v) => !v)} type="button" aria-label="Focus settings">{'\u22EE'}</button>
          {settingsOpen && (
            <div className="fm-settings">
              <span className="fm-set-label">Timer</span>
              <div className="fm-set-durs">
                {DURATIONS.map((d, i) => (
                  <button key={d.label} type="button" className={'fm-set-dur' + (durationIdx === i && !customMin ? ' active' : '')} onClick={() => { setDurationIdx(i); setCustomMin('') }}>{d.label}</button>
                ))}
                <input
                  className={'fm-set-custom' + (customMin ? ' active' : '')}
                  type="number"
                  min={1}
                  max={480}
                  placeholder="Custom"
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                />
              </div>
              <label className="fm-set-row">
                <input type="checkbox" checked={autoBreak} onChange={(e) => setAutoBreak(e.target.checked)} />
                <span>Auto break after session</span>
                <i className={autoBreak ? 'on' : ''}>{autoBreak ? '\u2713' : ''}</i>
              </label>
              <label className="fm-set-row">
                <input type="checkbox" checked={confirmEnd} onChange={(e) => setConfirmEnd(e.target.checked)} />
                <span>Confirm before ending</span>
                <i className={confirmEnd ? 'on' : ''}>{confirmEnd ? '\u2713' : ''}</i>
              </label>
              <span className="fm-set-label">Sound</span>
              <div className="fm-set-sounds">
                {SOUNDS.map((s) => (
                  <button key={s.id} type="button" className={'fm-set-sound' + (sound === s.id ? ' active' : '')} onClick={() => setSound(s.id)}>{s.label}</button>
                ))}
              </div>
              <div className="fm-set-row static"><span>Notifications</span><i className="on">{'\u2713'} Blocked</i></div>
            </div>
          )}
        </div>
      </header>

      <div className="fm-setup-body">
        <div className="fm-setup-left">
          <div className="fm-id-block">
            <select className="fm-subject-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
              <option value="">Choose a subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className="fm-topic-input" placeholder="What are you studying?" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic" />
          </div>

          <div className="fm-goal-card">
            <span className="fm-goal-head">{'\uD83C\uDFAF'} Today's Goal</span>
            <textarea
              rows={2}
              placeholder="Understand constructors and create 3 examples."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <div className="fm-sound-row">
            <span>{'\uD83D\uDD0A'} Sound</span>
            {SOUNDS.map((s) => (
              <button key={s.id} type="button" className={'fm-sound-chip' + (sound === s.id ? ' active' : '')} onClick={() => setSound(s.id)}>{s.label}</button>
            ))}
          </div>
        </div>

        <div className="fm-setup-center">
          <span className="fm-session-meta">Session {todayDone + 1}</span>

          <div className="fm-timer-ring">
            <svg viewBox="0 0 200 200" className="fm-ring-svg">
              <circle cx="100" cy="100" r="88" className="fm-ring-bg" />
            </svg>
            <div className="fm-timer-inner">
              <div className="fm-hero-time">{clock(plannedSeconds)}</div>
              <span className="fm-timer-label">{customMin ? customMin + ' min' : DURATIONS[durationIdx].label}</span>
            </div>
          </div>

          <button className="fm-start-focus-btn" onClick={startSession} type="button">
            {'\u25B6'} Start Focus
          </button>

          <span className="fm-dfm-note">{'\uD83D\uDD15'} Distraction-free mode while studying</span>
        </div>
      </div>
    </div>
  )

  const running = (
    <div
      className={'fm-run' + (uiVisible ? ' ui-on' : '')}
      onClick={() => setUiVisible(true)}
      role="presentation"
    >
      <button
        className={'fm-exit-x' + (uiVisible ? ' show' : '')}
        onClick={(e) => { e.stopPropagation(); requestEnd() }}
        type="button"
        aria-label="Exit session"
      >
        {'\u2715'}
      </button>

      <div className="fm-run-center">
        <div className="fm-hero-time xl">{clock(secondsLeft)}</div>
        <div className="fm-line"><i style={{ width: progress + '%' }} /></div>
        <div className="fm-run-subject">
          {subjectName ? <b style={{ color: subjectColor }}>{subjectName}</b> : <b>Focus session</b>}
          {topic ? <span>{topic}</span> : null}
          {goal ? <em>{'\uD83C\uDFAF'} {goal}</em> : null}
        </div>

        <button
          className="fm-pause-btn"
          onClick={(e) => { e.stopPropagation(); phase === 'paused' ? resumeSession() : pauseSession() }}
          type="button"
          aria-label={phase === 'paused' ? 'Resume' : 'Pause'}
        >
          {phase === 'paused' ? '\u25B6' : '\u275A\u275A'}
        </button>

        <div className={'fm-run-controls' + (uiVisible ? ' show' : '')}>
          {phase === 'paused'
            ? <button className="fm-main-btn" onClick={(e) => { e.stopPropagation(); resumeSession() }} type="button">{'\u25B6'} Resume</button>
            : <button className="fm-main-btn" onClick={(e) => { e.stopPropagation(); pauseSession() }} type="button">{'\u275A\u275A'} Pause</button>}
          <button className="fm-ghost-btn" onClick={(e) => { e.stopPropagation(); requestEnd() }} type="button">{'\u2715'} End Session</button>
        </div>
      </div>

      <div className="fm-dfm-pill">{'\uD83D\uDD15'} Notifications paused {'\u00B7'} Focus session active</div>

      <div className={'fm-run-tools' + (uiVisible ? ' show' : '')}>
        <button onClick={(e) => { e.stopPropagation(); void openStudy() }} type="button">{'\uD83D\uDCD6'} Study Material</button>
        <button onClick={(e) => { e.stopPropagation(); setAiOpen(true) }} type="button">{'\u2726'} Ask AI</button>
        <button onClick={(e) => { e.stopPropagation(); setSound(sound === 'none' ? 'rain' : 'none') }} type="button">{sound === 'none' ? '\uD83D\uDD07' : '\uD83D\uDD0A'} {SOUNDS.find((s) => s.id === sound)?.label}</button>
      </div>
    </div>
  )

  const breakScreen = (
    <div className="fm-break">
      <h1 className="fm-break-title">{'\u2726'} Great work!</h1>
      <div className="fm-break-done">{clock(totalSeconds)} <span>Focus session</span></div>
      <div className="fm-break-flag">{'\uD83C\uDFAF'} Session completed</div>
      <p className="fm-break-sub">Take a short break.</p>

      <div className="fm-break-count">
        <span>BREAK</span>
        <strong>{clock(breakLeft)}</strong>
        <div className="fm-line mint"><i style={{ width: ((5 * 60 - breakLeft) / (5 * 60)) * 100 + '%' }} /></div>
      </div>

      <button className="fm-ghost-btn" onClick={skipBreak} type="button">Skip Break {'\u2192'}</button>
    </div>
  )

  const complete = (
    <div className="fm-complete">
      <div className="fm-complete-inner">
        <span className="fm-complete-emoji">{'\uD83C\uDF89'}</span>
        <h1 className="fm-complete-heading">Session Complete</h1>
        <div className="fm-complete-time">{completedMinutes} min</div>
        <div className="fm-complete-sub">
          {subjectName ? <b>{subjectName}</b> : <b>Focus</b>}
          {topic ? <span>{topic}</span> : null}
        </div>

        <div className="fm-stat-chips">
          <div className="fm-chip">{'\u23F1'} {completedMinutes} min</div>
          <div className="fm-chip">{'\uD83C\uDFAF'} Focus {focusScore}%</div>
          <div className="fm-chip">{'\uD83D\uDD25'} {streakDelta === 1 ? '+1 day' : streak + ' days'}</div>
        </div>

        <p className="fm-complete-question">How did it go?</p>
        <div className="fm-complete-moods">
          {MOODS.map((m) => (
            <button key={m.value} className={'fm-complete-mood' + (mood === m.value ? ' active' : '')} onClick={() => setMood(m.value)} type="button">
              <span>{m.emoji}</span>
              <small>{m.label}</small>
            </button>
          ))}
        </div>

        <input
          className="fm-review-input"
          placeholder="What should you review later? (optional)"
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
        />

        <button className="fm-complete-save" onClick={finishSession} disabled={saving} type="button">
          {saving ? 'Saving…' : 'Finish Session'}
        </button>
      </div>
    </div>
  )

  return (
    <div className={'fm-root' + (immersive ? ' immersive' : '')}>
      {phase === 'setup' && setup}
      {(phase === 'running' || phase === 'paused') && running}
      {phase === 'break' && breakScreen}
      {phase === 'complete' && complete}

      <aside className={'fm-study' + (studyOpen ? ' open' : '')} aria-hidden={!studyOpen}>
        <header>
          <span>{'\uD83D\uDCD6'} Study Material</span>
          <button onClick={() => setStudyOpen(false)} type="button" aria-label="Close study material">{'\u00D7'}</button>
        </header>
        {topic ? <h3>{subjectName ? subjectName + ' — ' : ''}{topic}</h3> : <h3>Your notes</h3>}
        <div className="fm-study-list">
          {notes === null && <p className="fm-empty">Loading notes…</p>}
          {notes !== null && !studyMatches.length && <p className="fm-empty">No notes yet — create some on the Notes page.</p>}
          {studyMatches.map((n) => (
            <article key={n.id}>
              <b>{n.title || 'Untitled note'}</b>
              <p>{htmlStrip(n.content).slice(0, 260)}{(htmlStrip(n.content).length > 260) ? '…' : ''}</p>
            </article>
          ))}
        </div>
        <Link className="fm-study-open" to="/notes" onClick={() => setStudyOpen(false)}>Open Notes {'\u2192'}</Link>
      </aside>

      <aside className={'fm-ai' + (aiOpen ? ' open' : '')} aria-hidden={!aiOpen}>
        <header>
          <span>{'\u2726'} FocusFlow AI</span>
          <button onClick={() => setAiOpen(false)} type="button" aria-label="Close AI help">{'\u00D7'}</button>
        </header>
        <div className="fm-ai-thread">
          {!aiMessages.length && <p className="fm-empty">What are you stuck on?</p>}
          {aiMessages.map((m, i) => (
            <div key={i} className={'fm-ai-msg ' + m.role}>{m.text}</div>
          ))}
          {aiBusy && <div className="fm-ai-msg ai">Thinking…</div>}
        </div>
        <form
          className="fm-ai-compose"
          onSubmit={(e) => { e.preventDefault(); void askAi(aiInput) }}
        >
          <input
            placeholder={'e.g. "I don\'t understand copy constructors."'}
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
          />
          <button type="submit" disabled={aiBusy || !aiInput.trim()}>Send</button>
        </form>
        <div className="fm-ai-quick">
          <button type="button" disabled={aiBusy} onClick={() => void askAi('Explain that in simpler terms.')}>Explain Simpler</button>
          <button type="button" disabled={aiBusy} onClick={() => void askAi('Give me a concrete example.')}>Give Example</button>
        </div>
        <button className="fm-ai-back" onClick={() => setAiOpen(false)} type="button">Back to Focus {'\u2192'}</button>
      </aside>

      {confirmOpen && (
        <div className="fm-confirm-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="fm-confirm" onClick={(e) => e.stopPropagation()}>
            <b>End session early?</b>
            <p>You have studied {completedMinutes} min. Ending now will still save your progress.</p>
            <div className="fm-confirm-actions">
              <button className="fm-ghost-btn" onClick={() => setConfirmOpen(false)} type="button">Keep Going</button>
              <button className="fm-main-btn" onClick={() => { setConfirmOpen(false); setPhase('complete') }} type="button">End &amp; Save</button>
            </div>
            <button className="fm-confirm-discard" onClick={discardSession} type="button">Discard without saving</button>
          </div>
        </div>
      )}
    </div>
  )
}
