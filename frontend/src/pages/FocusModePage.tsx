import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { floxToast as toast } from '../components/FloxToast'
import { IconSettings } from '../components/icons'
import { ResponsiveBottomSheet } from '../components/ResponsiveBottomSheet'
import { api, getErrorMessage } from '../lib/api'
import { notifyStudyActivity } from '../lib/studyActivity'
import { useStreak } from '../hooks/useStreak'

type Subject = { id: number; name: string; color?: string }
type NoteLite = { id: number; title: string; content: string }

type Phase = 'setup' | 'running' | 'paused' | 'break' | 'complete'

type SoundId = 'none' | 'rain' | 'brown' | 'lofi'

/**
 * A focus session that is currently in progress is persisted to localStorage
 * so a refresh / app reopen resumes exactly where the user left off. Timing
 * is wall-clock based (sessionEndAt), never a decrementing counter, so the
 * countdown stays accurate even when the tab is backgrounded.
 */
type ActiveSession = {
  phase: 'running' | 'paused'
  totalSeconds: number
  secondsLeft: number
  sessionEndAt: number
  pauseCount: number
  subjectId: string
  topic: string
  sound: SoundId
}

const DURATIONS = [
  { label: '25 min', seconds: 25 * 60 },
  { label: '50 min', seconds: 50 * 60 },
  { label: '90 min', seconds: 90 * 60 },
]

const MOODS = [
  { emoji: '\u{1F62B}', value: 'difficult', label: 'Difficult' },
  { emoji: '\u{1F610}', value: 'okay', label: 'Okay' },
  { emoji: '\u{1F642}', value: 'good', label: 'Good' },
  { emoji: '\u{1F525}', value: 'excellent', label: 'Excellent' },
] as const

const SOUNDS: Array<{ id: SoundId; label: string }> = [
  { id: 'none', label: 'Off' },
  { id: 'rain', label: 'Rain' },
  { id: 'brown', label: 'Brown' },
  { id: 'lofi', label: 'Lo-fi' },
]

const PREFERENCES_KEY = 'FLOX.settings.v2'
const SETTINGS_KEY = 'FLOX.focus.settings.v1'
const ACTIVE_KEY = 'FLOX.focus.active.v1'

type SharedPreferences = {
  sessionLength: number
  breakLength: number
  autoStartBreak: boolean
  defaultSound: string
  studySounds: boolean
}

const defaultSharedPrefs: SharedPreferences = { sessionLength: 50, breakLength: 10, autoStartBreak: false, defaultSound: 'rain', studySounds: true }

function loadSharedPrefs(): SharedPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY)
    if (raw) return { ...defaultSharedPrefs, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return defaultSharedPrefs
}

function settingsSoundToFocus(s: string): SoundId {
  if (s === 'silence') return 'none'
  if (s === 'rain') return 'rain'
  if (s === 'lofi') return 'lofi'
  return 'brown'
}

function focusSoundToSettings(s: SoundId): string {
  if (s === 'none') return 'silence'
  if (s === 'rain') return 'rain'
  if (s === 'lofi') return 'lofi'
  return 'white-noise'
}

function minutesToDurationIdx(minutes: number): number {
  const idx = DURATIONS.findIndex((d) => d.seconds === minutes * 60)
  return idx >= 0 ? idx : 1
}

type PersistedSettings = {
  durationIdx: number
  customMin: string
  sound: SoundId
  autoBreak: boolean
  confirmEnd: boolean
  breakMinutes: number
}

function loadSettings(): PersistedSettings {
  const prefs = loadSharedPrefs()
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<PersistedSettings>
      return {
        durationIdx: saved.durationIdx ?? minutesToDurationIdx(prefs.sessionLength),
        customMin: saved.customMin ?? '',
        sound: saved.sound ?? (prefs.studySounds ? settingsSoundToFocus(prefs.defaultSound) : 'none'),
        autoBreak: saved.autoBreak ?? prefs.autoStartBreak,
        confirmEnd: saved.confirmEnd ?? true,
        breakMinutes: saved.breakMinutes ?? prefs.breakLength,
      }
    }
  } catch { /* ignore */ }
  return {
    durationIdx: minutesToDurationIdx(prefs.sessionLength),
    customMin: '',
    sound: prefs.studySounds ? settingsSoundToFocus(prefs.defaultSound) : 'none',
    autoBreak: prefs.autoStartBreak,
    confirmEnd: true,
    breakMinutes: prefs.breakLength,
  }
}

function saveSharedPrefs(updates: Partial<SharedPreferences>) {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY)
    const existing = raw ? JSON.parse(raw) : {}
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...existing, ...updates }))
  } catch { /* ignore */ }
}

function loadActiveSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ActiveSession>
    if (parsed.phase !== 'running' && parsed.phase !== 'paused') return null
    if (!parsed.totalSeconds || parsed.totalSeconds <= 0) return null
    return {
      phase: parsed.phase,
      totalSeconds: parsed.totalSeconds,
      secondsLeft: typeof parsed.secondsLeft === 'number' && parsed.secondsLeft > 0 ? parsed.secondsLeft : parsed.totalSeconds,
      sessionEndAt: typeof parsed.sessionEndAt === 'number' ? parsed.sessionEndAt : 0,
      pauseCount: parsed.pauseCount ?? 0,
      subjectId: parsed.subjectId ?? '',
      topic: parsed.topic ?? '',
      sound: parsed.sound ?? 'none',
    }
  } catch { /* ignore */ }
  return null
}

function durationSeconds(durationIdx: number, customMin: string): number {
  return Number(customMin) > 0 ? Number(customMin) * 60 : DURATIONS[durationIdx].seconds
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
  const restored = useMemo(loadActiveSession, [])

  const [subjects, setSubjects] = useState<Subject[]>([])

  const [phase, setPhase] = useState<Phase>(() => {
    if (!restored) return 'setup'
    if (restored.phase === 'paused') return 'paused'
    if (restored.phase === 'running' && restored.sessionEndAt > Date.now()) return 'running'
    // The running session elapsed while the app was closed: go straight to
    // reflection so the user can still save the completed time.
    return 'complete'
  })

  const defaultTotal = restored?.totalSeconds ?? durationSeconds(initial.durationIdx, initial.customMin)

  const [subjectId, setSubjectId] = useState(restored?.subjectId ?? '')
  const [topic, setTopic] = useState(restored?.topic ?? '')
  const [durationIdx, setDurationIdx] = useState(initial.durationIdx)
  const [customMin, setCustomMin] = useState(initial.customMin)
  const [sound, setSound] = useState<SoundId>(restored?.sound ?? initial.sound)
  const [autoBreak, setAutoBreak] = useState(initial.autoBreak)
  const [confirmEnd, setConfirmEnd] = useState(initial.confirmEnd)
  const [breakMinutes, setBreakMinutes] = useState(initial.breakMinutes)

  const [totalSeconds, setTotalSeconds] = useState(defaultTotal)
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!restored) return defaultTotal
    if (restored.phase === 'running') {
      const left = Math.ceil((restored.sessionEndAt - Date.now()) / 1000)
      return left > 0 ? left : 0
    }
    return Math.max(1, restored.secondsLeft)
  })
  const [breakLeft, setBreakLeft] = useState(initial.breakMinutes * 60)
  const [pauseCount, setPauseCount] = useState(restored?.pauseCount ?? 0)

  const secondsLeftRef = useRef(secondsLeft)
  useEffect(() => { secondsLeftRef.current = secondsLeft }, [secondsLeft])

  // Wall-clock deadline for the current running segment (0 = not armed).
  const endAtRef = useRef(restored?.phase === 'running' && restored.sessionEndAt > Date.now() ? restored.sessionEndAt : 0)
  const breakEndRef = useRef(0)
  const breakTotalRef = useRef(initial.breakMinutes * 60)

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
  const [celebrate, setCelebrate] = useState(false)

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const breakTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const soundSourceRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data } = await api.get<Subject[]>('/study/subjects/')
        if (active) setSubjects(data)
      } catch (err) { if (active) toast.error(getErrorMessage(err)) }
    }
    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ durationIdx, customMin, sound, autoBreak, confirmEnd, breakMinutes }))
    const durationMinutes = Number(customMin) > 0 ? Number(customMin) : durationSeconds(durationIdx, customMin) / 60
    saveSharedPrefs({
      sessionLength: durationMinutes,
      autoStartBreak: autoBreak,
      defaultSound: focusSoundToSettings(sound),
      studySounds: sound !== 'none',
      breakLength: breakMinutes,
    })
  }, [durationIdx, customMin, sound, autoBreak, confirmEnd, breakMinutes])

  // Persist an in-progress session so a refresh resumes it. The record is only
  // removed once the user finishes, discards, or leaves the setup screen.
  useEffect(() => {
    if (phase === 'setup') {
      localStorage.removeItem(ACTIVE_KEY)
      return
    }
    if (phase !== 'running' && phase !== 'paused') return
    const rec: ActiveSession = {
      phase,
      totalSeconds,
      secondsLeft: secondsLeftRef.current,
      sessionEndAt: endAtRef.current,
      pauseCount,
      subjectId,
      topic,
      sound,
    }
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(rec)) } catch { /* ignore */ }
  }, [phase, totalSeconds, secondsLeft, pauseCount, subjectId, topic, sound])

  const immersive = phase === 'running' || phase === 'paused' || phase === 'break'

  useEffect(() => {
    document.body.classList.toggle('fm-immersive', immersive)
    return () => { document.body.classList.remove('fm-immersive') }
  }, [immersive])

  // Hide the global app chrome (bottom nav / floating bot) for the whole Focus
  // route so it never occludes the primary Start button on the setup screen.
  useEffect(() => {
    document.body.classList.add('fm-focus-route')
    return () => { document.body.classList.remove('fm-focus-route') }
  }, [])

  const subject = useMemo(() => subjects.find((s) => String(s.id) === subjectId), [subjects, subjectId])
  const subjectName = subject?.name ?? ''
  const subjectColor = subject?.color ?? '#ff8a5c'
  const progress = totalSeconds > 0 ? Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100) : 0

  const plannedSeconds = durationSeconds(durationIdx, customMin)

  // Streak + today's focus come from the shared backend source of truth
  // (GET /study/dashboard/ via useStreak), never from a local counter, so the
  // Focus page always matches Dashboard / Profile / Progress.
  const { streak, loading: streakLoading, error: streakError, refresh: refreshStreak } = useStreak()

  const DAILY_GOAL_MINUTES = 30

  const days = streakLoading && !streak ? null : (streak?.current_streak ?? 0)
  const streakDayLabel = days === null
    ? '\u2014 day'
    : `${days} day${days === 1 ? '' : 's'}`

  const todayMinutes = streak?.today_minutes ?? 0
  const todayMinutesLabel = streakLoading && !streak ? '\u2014' : String(todayMinutes)
  const todayPct = Math.min(100, Math.round((todayMinutes / DAILY_GOAL_MINUTES) * 100))

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

  // Timestamp-based focus timer: a 250ms tick recomputes the remaining time
  // from the wall clock, so background throttling / sleep never drifts it.
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (phase !== 'running') return
    if (endAtRef.current <= 0) endAtRef.current = Date.now() + secondsLeftRef.current * 1000
    tickRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
      setSecondsLeft((p) => (p === left ? p : left))
      if (left <= 0) {
        if (tickRef.current) clearInterval(tickRef.current)
        endAtRef.current = 0
        playChime()
        setPhase(autoBreak ? 'break' : 'complete')
        if (autoBreak) {
          breakEndRef.current = 0
          breakTotalRef.current = breakMinutes * 60
          setBreakLeft(breakMinutes * 60)
        }
      }
    }, 250)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [phase, autoBreak, breakMinutes, playChime])

  // Timestamp-based break timer.
  useEffect(() => {
    if (breakTickRef.current) clearInterval(breakTickRef.current)
    if (phase !== 'break') return
    if (breakEndRef.current <= 0) breakEndRef.current = Date.now() + breakTotalRef.current * 1000
    breakTickRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((breakEndRef.current - Date.now()) / 1000))
      setBreakLeft((p) => (p === left ? p : left))
      if (left <= 0) {
        if (breakTickRef.current) clearInterval(breakTickRef.current)
        breakEndRef.current = 0
        setPhase('complete')
      }
    }, 250)
    return () => { if (breakTickRef.current) clearInterval(breakTickRef.current) }
  }, [phase])

  useEffect(() => {
    if ((phase === 'running' || phase === 'paused') && sound !== 'none') startAmbience(sound)
    else stopAmbience()
    return stopAmbience
  }, [phase, sound, startAmbience, stopAmbience])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (phase !== 'running') { setUiVisible(true); return }
    const t = setTimeout(() => setUiVisible(false), 3200)
    return () => clearTimeout(t)
  }, [phase, uiVisible])

  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') {
      document.title = 'FLOX AI'
      return
    }
    const base = 'FLOX AI \u2014 Focus'
    const id = setInterval(() => {
      document.title = clock(secondsLeftRef.current) + ' \u00B7 ' + base
    }, 1000)
    document.title = clock(secondsLeftRef.current) + ' \u00B7 ' + base
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [phase])

  function startSession() {
    const secs = durationSeconds(durationIdx, customMin)
    setTotalSeconds(secs)
    secondsLeftRef.current = secs
    setSecondsLeft(secs)
    endAtRef.current = Date.now() + secs * 1000
    setPauseCount(0)
    setMood('')
    setReviewNote('')
    setAiMessages([])
    setUiVisible(true)
    setCelebrate(false)
    setPhase('running')
  }

  function pauseSession() {
    const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
    secondsLeftRef.current = remaining
    setSecondsLeft(remaining)
    endAtRef.current = 0
    setPauseCount((p) => p + 1)
    setUiVisible(true)
    setPhase('paused')
  }

  function resumeSession() {
    endAtRef.current = Date.now() + Math.max(1, secondsLeftRef.current) * 1000
    setPhase('running')
  }

  function requestEnd() {
    const elapsed = totalSeconds - secondsLeftRef.current
    if (elapsed >= 60 && confirmEnd) { setConfirmOpen(true); return }
    if (elapsed >= 60) { setPhase('complete'); return }
    discardSession()
  }

  function discardSession() {
    setConfirmOpen(false)
    stopAmbience()
    endAtRef.current = 0
    setPhase('setup')
    setSecondsLeft(totalSeconds)
    secondsLeftRef.current = totalSeconds
    setMood('')
    setReviewNote('')
  }

  function skipBreak() {
    breakEndRef.current = 0
    setPhase('complete')
  }

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
      notifyStudyActivity()
      setAiMessages((prev) => [...prev, { role: 'ai', text: data.reply }])
    } catch {
      setAiMessages((prev) => [...prev, { role: 'ai', text: "FLOX AI couldn't respond right now. Your timer is still running \u2014 try again in a moment." }])
      toast.error("FLOX AI couldn't respond right now.")
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
      notifyStudyActivity()
      // Pull the freshly-recomputed streak: the backend marks today's study
      // day and counts it once, no matter how many activities happen today.
      void refreshStreak()
      toast.success('Focus session saved \u2014 great work!')
      stopAmbience()
      setPhase('setup')
      setSecondsLeft(plannedSeconds)
      secondsLeftRef.current = plannedSeconds
      setMood('')
      setReviewNote('')
      setCelebrate(completedMinutes >= 30)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const setup = (
    <div className="fm-setup">
      <header className="fm-top">
        <Link to="/dashboard" className="fm-setup-back">{'\u2190'} Focus Mode</Link>
        <div className="fm-top-right">
          <button
            className={'fm-kebab' + (settingsOpen ? ' open' : '')}
            onClick={() => setSettingsOpen((v) => !v)}
            type="button"
            aria-label="Focus settings"
            aria-expanded={settingsOpen}
          >
            <IconSettings size={18} />
          </button>
          {settingsOpen && (
            <div className="fm-settings">
              <span className="fm-set-label">Break</span>
              <label className="fm-set-row">
                <input type="checkbox" checked={autoBreak} onChange={(e) => setAutoBreak(e.target.checked)} />
                <span>Auto break after session</span>
                <i className={autoBreak ? 'on' : ''}>{autoBreak ? '\u2713' : ''}</i>
              </label>
              <label className="fm-set-row">
                <span>Break duration</span>
                <select value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))}>
                  {[5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </label>
              <label className="fm-set-row">
                <input type="checkbox" checked={confirmEnd} onChange={(e) => setConfirmEnd(e.target.checked)} />
                <span>Confirm before ending</span>
                <i className={confirmEnd ? 'on' : ''}>{confirmEnd ? '\u2713' : ''}</i>
              </label>
              <div className="fm-set-row static"><span>Notifications</span><i className="on">{'\u2713'} Blocked</i></div>
            </div>
          )}
        </div>
      </header>

      <div className="fm-setup-body">
        <div className="fm-task-block">
          <select className="fm-subject-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
            <option value="">Choose a subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="fm-topic-input" placeholder="What are you studying?" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic" />
        </div>

        <div className="fm-timer-hero">
          <div className="fm-timer-ring">
            <svg viewBox="0 0 200 200" className="fm-ring-svg" aria-hidden="true">
              <circle cx="100" cy="100" r="88" className="fm-ring-bg" />
            </svg>
            <div className="fm-timer-inner">
              <div className="fm-hero-time">{clock(plannedSeconds)}</div>
              <span className="fm-timer-label">{customMin ? customMin + ' min' : DURATIONS[durationIdx].label}</span>
            </div>
          </div>

          <div className="fm-dur-row">
            {DURATIONS.map((d, i) => (
              <button key={d.label} type="button" className={'fm-set-dur' + (durationIdx === i && !customMin ? ' active' : '')} onClick={() => { setDurationIdx(i); setCustomMin('') }}>{d.label}</button>
            ))}
            <input
              className={'fm-set-custom' + (customMin ? ' active' : '')}
              type="number"
              min={1}
              max={480}
              placeholder="Custom"
              aria-label="Custom duration in minutes"
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
            />
          </div>
        </div>

        <div className="fm-goal-strip">
          <span className="fm-goal-stat">{'\uD83D\uDD25'} {streakDayLabel}</span>
          <span className="fm-goal-sep" aria-hidden="true">{'\u00B7'}</span>
          <span className="fm-goal-stat">{'\uD83C\uDFAF'} {todayMinutesLabel} / {DAILY_GOAL_MINUTES} min</span>
          {streakError && (
            <button className="fm-streak-retry" onClick={() => void refreshStreak()} type="button" aria-label="Retry streak" title="Retry">{'\u21BB'}</button>
          )}
        </div>
        <div className="fm-today-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={todayPct} aria-label="Today's focus progress">
          <i style={{ width: todayPct + '%' }} />
        </div>

        {celebrate && todayMinutes >= DAILY_GOAL_MINUTES && (
          <div className="fm-celebrate">{'\uD83C\uDF89'} Focus goal completed! {DAILY_GOAL_MINUTES} minutes studied {'\u00B7'} {'\uD83D\uDD25'} {streakDayLabel}</div>
        )}

        <div className="fm-sound-row">
          <span className="fm-sound-label">{'\uD83D\uDD0A'} Sound</span>
          <div className="fm-sound-chips">
            {SOUNDS.map((s) => (
              <button key={s.id} type="button" className={'fm-sound-chip' + (sound === s.id ? ' active' : '')} onClick={() => setSound(s.id)} aria-pressed={sound === s.id}>{s.label}</button>
            ))}
          </div>
        </div>

        <button className="fm-start-focus-btn" onClick={startSession} type="button">
          {'\u25B6'} Start Focus
        </button>

        <span className="fm-dfm-note">{'\uD83D\uDD15'} Distraction-free mode while studying</span>
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

      <div className="fm-run-brand-row">
        <span className="fm-run-brand">Focus Mode</span>
        <span className="fm-run-status">{phase === 'paused' ? 'Paused' : 'Session active'}</span>
      </div>

      <div className="fm-run-center">
        <div className="fm-hero-time xl">
          <span role="timer" aria-label={clock(secondsLeft)}>{clock(secondsLeft)}</span>
        </div>
        <div className="fm-line"><i style={{ width: progress + '%' }} /></div>
        <div className="fm-run-subject">
          <b style={{ color: subjectColor }}>{subjectName ? subjectName : 'Focus session'}</b>
          {topic ? <span>{topic}</span> : null}
        </div>
        <div className="fm-run-streak">
          <span>{'\uD83D\uDD25'} {streakDayLabel}</span>
          <i className="fm-run-streak-sep" aria-hidden="true">{'\u00B7'}</i>
          <span>{'\uD83C\uDFAF'} {todayMinutesLabel} / {DAILY_GOAL_MINUTES} min</span>
        </div>
      </div>

      <div className="fm-run-actions">
        <button
          className="fm-pause-btn"
          onClick={(e) => { e.stopPropagation(); if (phase === 'paused') resumeSession(); else pauseSession() }}
          type="button"
          aria-label={phase === 'paused' ? 'Resume focus' : 'Pause focus'}
        >
          {phase === 'paused' ? '\u25B6' : '\u275A\u275A'}
        </button>

        <button
          className="fm-end-link"
          onClick={(e) => { e.stopPropagation(); requestEnd() }}
          type="button"
        >
          End Session
        </button>
      </div>

      <div className={'fm-run-tools' + (uiVisible ? ' show' : '')}>
        <button onClick={(e) => { e.stopPropagation(); void openStudy() }} type="button">{'\uD83D\uDCD6'} Study Material</button>
        <button onClick={(e) => { e.stopPropagation(); setAiOpen(true) }} type="button">{'\u2726'} Ask AI</button>
        <button onClick={(e) => { e.stopPropagation(); setSound(sound === 'none' ? 'rain' : 'none') }} type="button">{sound === 'none' ? '\uD83D\uDD07' : '\uD83D\uDD0A'} {SOUNDS.find((s) => s.id === sound)?.label}</button>
      </div>

      <div className="fm-dfm-pill">{'\uD83D\uDD15'} Notifications paused {'\u00B7'} Focus session active</div>
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
        <strong role="timer" aria-label={'Break time ' + clock(breakLeft)}>{clock(breakLeft)}</strong>
        <div className="fm-line mint"><i style={{ width: ((breakMinutes * 60 - breakLeft) / (breakMinutes * 60)) * 100 + '%' }} /></div>
      </div>

      <button className="fm-ghost-btn" onClick={skipBreak} type="button">Skip Break {'\u2192'}</button>
    </div>
  )

  const complete = (
    <div className="fm-complete">
      <div className="fm-complete-inner">
        <span className="fm-complete-emoji">{'\uD83C\uDF89'}</span>
        <h1 className="fm-complete-heading">Session Complete</h1>
        <div className="fm-complete-time" aria-label={completedMinutes + ' minutes'}>{completedMinutes} min</div>
        <div className="fm-complete-sub">
          {subjectName ? <b>{subjectName}</b> : <b>Focus</b>}
          {topic ? <span>{topic}</span> : null}
        </div>

        <div className="fm-stat-chips">
          <div className="fm-chip">{'\u23F1'} {completedMinutes} min</div>
          <div className="fm-chip">{'\uD83C\uDFAF'} Focus {focusScore}%</div>
          {completedMinutes >= 30 && <div className="fm-chip goal">{'\uD83C\uDF89'} 30-min goal</div>}
          <div className="fm-chip">{'\uD83D\uDD25'} {streakDayLabel}</div>
        </div>

        <p className="fm-complete-question">How did it go?</p>
        <div className="fm-complete-moods">
          {MOODS.map((m) => (
            <button key={m.value} className={'fm-complete-mood' + (mood === m.value ? ' active' : '')} onClick={() => setMood(m.value)} type="button" aria-pressed={mood === m.value}>
              <span aria-hidden="true">{m.emoji}</span>
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
          {saving ? 'Saving\u2026' : 'Finish Session'}
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

      <div
        className={'fm-scrim' + (studyOpen || aiOpen ? ' show' : '')}
        onClick={() => { setStudyOpen(false); setAiOpen(false) }}
        aria-hidden={!studyOpen && !aiOpen}
      />

      <aside className={'fm-study' + (studyOpen ? ' open' : '')} aria-hidden={!studyOpen}>
        <header>
          <span>{'\uD83D\uDCD6'} Study Material</span>
          <button onClick={() => setStudyOpen(false)} type="button" aria-label="Close study material">{'\u00D7'}</button>
        </header>
        {topic ? <h3>{subjectName ? subjectName + ' \u2014 ' : ''}{topic}</h3> : <h3>Your notes</h3>}
        <div className="fm-study-list">
          {notes === null && <p className="fm-empty">Loading notes\u2026</p>}
          {notes !== null && !studyMatches.length && <p className="fm-empty">No notes yet \u2014 create some on the Notes page.</p>}
          {studyMatches.map((n) => (
            <article key={n.id}>
              <b>{n.title || 'Untitled note'}</b>
              <p>{htmlStrip(n.content).slice(0, 260)}{(htmlStrip(n.content).length > 260) ? '\u2026' : ''}</p>
            </article>
          ))}
        </div>
        <Link className="fm-study-open" to="/notes" onClick={() => setStudyOpen(false)}>Open Notes {'\u2192'}</Link>
      </aside>

      <aside className={'fm-ai' + (aiOpen ? ' open' : '')} aria-hidden={!aiOpen}>
        <header>
          <span>{'\u2726'} FLOX AI</span>
          <button onClick={() => setAiOpen(false)} type="button" aria-label="Close AI help">{'\u00D7'}</button>
        </header>
        <div className="fm-ai-thread">
          {!aiMessages.length && <p className="fm-empty">What are you stuck on?</p>}
          {aiMessages.map((m, i) => (
            <div key={i} className={'fm-ai-msg ' + m.role}>{m.text}</div>
          ))}
          {aiBusy && <div className="fm-ai-msg ai">Thinking\u2026</div>}
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

      <ResponsiveBottomSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="End session early?"
        footer={
          <div className="fm-confirm-actions">
            <button className="fm-ghost-btn" onClick={() => setConfirmOpen(false)} type="button">Continue</button>
            <button className="fm-main-btn" onClick={() => { setConfirmOpen(false); setPhase('complete') }} type="button">End Session</button>
          </div>
        }
      >
        <p className="fm-confirm-copy">Your current session is {completedMinutes} minute{completedMinutes === 1 ? '' : 's'}. Ending now saves your progress{completedMinutes < 30 ? ' \u2014 it is under the 30-minute goal, so it will not count as a focus-goal day by itself.' : '.'}</p>
        <button className="fm-confirm-discard" onClick={discardSession} type="button">Discard without saving</button>
      </ResponsiveBottomSheet>
    </div>
  )
}