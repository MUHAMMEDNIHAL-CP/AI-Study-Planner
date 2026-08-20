import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { api, getErrorMessage } from '../lib/api'

type Subject = { id: number; name: string; color?: string }
type FocusSession = { id: number; subject_name?: string; topic?: string; duration_minutes: number; started_at: string; mood?: string }

type Phase = 'setup' | 'focus' | 'paused' | 'break' | 'complete'

const DURATIONS = [
  { label: '25 min', seconds: 25 * 60 },
  { label: '50 min', seconds: 50 * 60 },
  { label: '90 min', seconds: 90 * 60 },
]

const MOODS = [
  { emoji: '😫', value: 'terrible' },
  { emoji: '😕', value: 'bad' },
  { emoji: '😐', value: 'okay' },
  { emoji: '🙂', value: 'good' },
  { emoji: '🤩', value: 'great' },
] as const

const SOUNDS = [
  { id: 'rain', label: 'Rain', icon: '🌧' },
  { id: 'cafe', label: 'Café', icon: '☕' },
  { id: 'noise', label: 'White Noise', icon: '📻' },
  { id: 'lofi', label: 'Lo-fi', icon: '🎵' },
  { id: 'none', label: 'None', icon: '🔇' },
] as const

function fmt(s: number) {
  return { m: Math.floor(s / 60).toString().padStart(2, '0'), s: (s % 60).toString().padStart(2, '0') }
}

export default function FocusModePage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [sessions, setSessions] = useState<FocusSession[]>([])

  const [phase, setPhase] = useState<Phase>('setup')
  const [subjectId, setSubjectId] = useState('')
  const [topic, setTopic] = useState('')
  const [durationIdx, setDurationIdx] = useState(1)
  const [customMin, setCustomMin] = useState('')
  const [recordStudy, setRecordStudy] = useState(true)
  const [updateStreak, setUpdateStreak] = useState(true)

  const [totalSeconds, setTotalSeconds] = useState(DURATIONS[1].seconds)
  const [secondsLeft, setSecondsLeft] = useState(DURATIONS[1].seconds)
  const [selectedMood, setSelectedMood] = useState('')
  const [activeSound, setActiveSound] = useState('none')
  const [showSoundMenu, setShowSoundMenu] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(5 * 60)

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
    void load(); return () => { active = false }
  }, [])

  const subjectName = useMemo(() => subjects.find((s) => String(s.id) === subjectId)?.name || '', [subjects, subjectId])
  const subjectColor = useMemo(() => subjects.find((s) => String(s.id) === subjectId)?.color || '#9CC9C5', [subjects, subjectId])
  const progress = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0
  const time = fmt(secondsLeft)
  const circumference = 2 * Math.PI * 130
  const dashOffset = circumference * (1 - progress / 100)

  const streak = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    let count = 0
    const d = new Date()
    while (true) {
      const ds = d.toISOString().slice(0, 10)
      const had = sessions.some((s) => s.started_at?.slice(0, 10) === ds && s.duration_minutes >= 20)
      if (!had) break
      count++
      d.setDate(d.getDate() - 1)
      if (ds === today) continue
    }
    return count
  }, [sessions])

  const playChime = useCallback(() => {
    try {
      const ctx = audioRef.current ??= new AudioContext()
      ;[880, 1100].forEach((freq, i) => {
        setTimeout(() => {
          const o = ctx.createOscillator(); const g = ctx.createGain()
          o.frequency.value = freq; g.gain.value = 0.05; o.connect(g); g.connect(ctx.destination)
          o.start(); o.stop(ctx.currentTime + 0.2)
        }, i * 150)
      })
    } catch { /* no audio */ }
  }, [])

  const startAmbience = useCallback((soundId: string) => {
    stopAmbience()
    if (soundId === 'none') return
    try {
      const ctx = audioRef.current ??= new AudioContext()
      if (soundId === 'lofi') {
        const osc = ctx.createOscillator(); const g = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = 174; g.gain.value = 0.03
        osc.connect(g); g.connect(ctx.destination); osc.start()
        soundSourceRef.current = { stop: () => osc.stop() }
        return
      }
      const bufSize = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (soundId === 'rain' ? 0.2 : soundId === 'cafe' ? 0.15 : 0.4)
      const src = ctx.createBufferSource(); const g = ctx.createGain()
      src.buffer = buf; src.loop = true; g.gain.value = soundId === 'rain' ? 0.08 : 0.06
      src.connect(g); g.connect(ctx.destination); src.start()
      soundSourceRef.current = { stop: () => src.stop() }
    } catch { /* no audio */ }
  }, [])

  const stopAmbience = useCallback(() => {
    soundSourceRef.current?.stop(); soundSourceRef.current = null
  }, [])

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (phase !== 'focus') return
    tickRef.current = setInterval(() => {
      setSecondsLeft((p) => {
        if (p <= 1) { playChime(); setPhase('complete'); return 0 }
        return p - 1
      })
    }, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [phase, playChime])

  useEffect(() => {
    if (breakTickRef.current) clearInterval(breakTickRef.current)
    if (phase !== 'break') return
    breakTickRef.current = setInterval(() => {
      setBreakSecondsLeft((p) => {
        if (p <= 1) { setPhase('focus'); setBreakSecondsLeft(5 * 60); return 5 * 60 }
        return p - 1
      })
    }, 1000)
    return () => { if (breakTickRef.current) clearInterval(breakTickRef.current) }
  }, [phase])

  useEffect(() => {
    if (phase === 'focus' && activeSound !== 'none') startAmbience(activeSound)
    else stopAmbience()
    return stopAmbience
  }, [phase, activeSound, startAmbience, stopAmbience])

  function startSession() {
    const secs = Number(customMin) * 60 || DURATIONS[durationIdx].seconds
    setTotalSeconds(secs); setSecondsLeft(secs); setPhase('focus'); setSelectedMood('')
  }

  function pauseSession() { setPhase('paused') }
  function resumeSession() { setPhase('focus') }
  function startBreak() { setBreakSecondsLeft(5 * 60); setPhase('break') }

  function exitFocus() {
    if (phase === 'focus' || phase === 'paused') {
      const elapsed = totalSeconds - secondsLeft
      if (elapsed < 60) { setPhase('setup'); return }
    }
    setPhase('setup'); setSecondsLeft(totalSeconds); setSelectedMood(''); stopAmbience()
  }

  async function saveSession() {
    const elapsed = totalSeconds - secondsLeft
    const mins = Math.max(1, Math.round(elapsed / 60))
    try {
      await api.post('/productivity/focus-sessions/', {
        subject: subjectId ? Number(subjectId) : null,
        duration_minutes: mins,
        completed: true,
        mood: selectedMood,
        topic: topic || undefined,
        notes: 'Focus session',
        date: new Date().toISOString().slice(0, 10),
      })
      toast.success('Session saved!')
      const { data } = await api.get<FocusSession[]>('/productivity/focus-sessions/')
      setSessions(data)
    } catch (err) { toast.error(getErrorMessage(err)) }
    setPhase('setup'); setSecondsLeft(totalSeconds); setSelectedMood('')
  }

  async function askAi() {
    if (!aiQuestion.trim()) return
    setAiLoading(true); setAiAnswer('')
    try {
      const { data } = await api.post('/ai/chat/', { message: aiQuestion, subject: subjectName || undefined })
      setAiAnswer(data.response || data.answer || 'No response')
    } catch { setAiAnswer('Sorry, I could not process that right now.') }
    setAiLoading(false)
  }

  const breakTime = fmt(breakSecondsLeft)

  return (
    <div className={`fm-root ${phase !== 'setup' ? 'fm-active' : ''}`}>

      {/* ═══════════ SETUP SCREEN ═══════════ */}
      {phase === 'setup' && (
        <div className="fm-setup">
          <div className="fm-setup-inner">
            <Link to="/dashboard" className="fm-setup-back">← Back to Dashboard</Link>
            <h1 className="fm-setup-title">Start Focus Session</h1>

            <div className="fm-setup-field">
              <label>Subject</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="fm-setup-field">
              <label>Topic</label>
              <input placeholder="e.g. Integration" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>

            <div className="fm-setup-field">
              <label>Duration</label>
              <div className="fm-dur-row">
                {DURATIONS.map((d, i) => (
                  <button key={d.label} className={`fm-dur-chip ${durationIdx === i && !customMin ? 'active' : ''}`} onClick={() => { setDurationIdx(i); setCustomMin('') }} type="button">{d.label}</button>
                ))}
                <div className={`fm-dur-custom ${customMin ? 'active' : ''}`}>
                  <input min="1" max="480" placeholder="Min" type="number" value={customMin} onChange={(e) => setCustomMin(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="fm-setup-toggles">
              <label className="fm-toggle"><input type="checkbox" checked={recordStudy} onChange={(e) => setRecordStudy(e.target.checked)} /><span className="fm-toggle-track" /><span>Record study time</span></label>
              <label className="fm-toggle"><input type="checkbox" checked={updateStreak} onChange={(e) => setUpdateStreak(e.target.checked)} /><span className="fm-toggle-track" /><span>Update streak</span></label>
            </div>

            <button className="fm-start-focus-btn" onClick={startSession} type="button">Start Focus</button>
          </div>
        </div>
      )}

      {/* ═══════════ FOCUS / PAUSED / BREAK ═══════════ */}
      {(phase === 'focus' || phase === 'paused' || phase === 'break') && (
        <div className="fm-focus">
          {/* Top bar */}
          <div className="fm-topbar">
            <button className="fm-topbar-btn" onClick={exitFocus} type="button">← Exit Focus</button>
            <Link to="/settings" className="fm-topbar-btn">⚙</Link>
          </div>

          {/* Center content */}
          <div className="fm-center-stack">
            {phase === 'break' && (
              <div className="fm-break-badge">☕ Break — {breakTime.m}:{breakTime.s}</div>
            )}

            {/* Subject */}
            {subjectName && <span className="fm-focus-subject" style={{ color: subjectColor }}>{subjectName}</span>}
            {topic && <span className="fm-focus-topic">{topic}</span>}

            {/* Ring */}
            <div className="fm-ring-wrap">
              <svg className="fm-ring-svg" viewBox="0 0 280 280">
                <defs>
                  <linearGradient id="fmG" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={subjectColor} />
                    <stop offset="100%" stopColor="#9CC9C5" />
                  </linearGradient>
                </defs>
                <circle cx="140" cy="140" r="130" className="fm-ring-track" />
                <circle cx="140" cy="140" r="130" className="fm-ring-arc" style={{ strokeDasharray: circumference, strokeDashoffset: phase === 'break' ? circumference * (1 - (5 * 60 - breakSecondsLeft) / (5 * 60)) : dashOffset, stroke: phase === 'break' ? '#9CC9C5' : 'url(#fmG)' }} />
              </svg>
              <div className="fm-ring-center">
                <span className="fm-big-time">{phase === 'break' ? `${breakTime.m}:${breakTime.s}` : `${time.m}:${time.s}`}</span>
              </div>
            </div>

            {/* Controls */}
            {phase !== 'break' && (
              <button className="fm-main-btn" onClick={phase === 'paused' ? resumeSession : pauseSession} type="button">
                {phase === 'paused' ? '▶ Resume' : '⏸ Pause'}
              </button>
            )}
            {phase === 'break' && (
              <button className="fm-main-btn" onClick={() => { setPhase('focus'); setBreakSecondsLeft(5 * 60) }} type="button">Skip Break</button>
            )}
          </div>

          {/* Bottom bar */}
          <div className="fm-bottom">
            <div className="fm-bottom-left">
              {/* Sound */}
              <div className="fm-bottom-group">
                <button className="fm-bottom-btn" onClick={() => { setShowSoundMenu(!showSoundMenu); setShowAiPanel(false) }} type="button">
                  <span>🔊</span><span>Sound</span>
                </button>
                {showSoundMenu && (
                  <div className="fm-popup fm-sound-popup">
                    {SOUNDS.map((s) => (
                      <button key={s.id} className={`fm-popup-item ${activeSound === s.id ? 'active' : ''}`} onClick={() => { setActiveSound(s.id); setShowSoundMenu(false) }} type="button">
                        <span>{s.icon}</span> {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Break */}
              {phase !== 'break' && (
                <button className="fm-bottom-btn" onClick={startBreak} type="button">
                  <span>☕</span><span>Break</span>
                </button>
              )}
            </div>

            <div className="fm-bottom-right">
              {/* AI */}
              <div className="fm-bottom-group">
                <button className="fm-bottom-btn" onClick={() => { setShowAiPanel(!showAiPanel); setShowSoundMenu(false) }} type="button">
                  <span>🤖</span><span>AI</span>
                </button>
                {showAiPanel && (
                  <div className="fm-popup fm-ai-popup">
                    <div className="fm-ai-head">🤖 Flox AI</div>
                    <p className="fm-ai-sub">Need help with something?</p>
                    <input className="fm-ai-input" placeholder={`Ask about ${topic || subjectName || 'anything'}...`} value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askAi()} />
                    <button className="fm-ai-send" onClick={askAi} type="button" disabled={aiLoading || !aiQuestion.trim()}>{aiLoading ? 'Thinking...' : 'Ask AI'}</button>
                    {aiAnswer && <div className="fm-ai-answer">{aiAnswer}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Streak */}
          <div className="fm-streak">🔥 {streak} day{streak !== 1 ? 's' : ''}</div>
        </div>
      )}

      {/* ═══════════ COMPLETE SCREEN ═══════════ */}
      {phase === 'complete' && (
        <div className="fm-complete">
          <div className="fm-complete-inner">
            <span className="fm-complete-emoji">🎉</span>
            <h1 className="fm-complete-heading">Session Complete!</h1>

            <div className="fm-complete-time">{Math.round((totalSeconds - secondsLeft) / 60)} minutes</div>

            {subjectName && <span className="fm-complete-subject">{subjectName}</span>}
            {topic && <span className="fm-complete-topic">{topic}</span>}

            <div className="fm-complete-streak">🔥 Streak: {streak + 1} day{streak + 1 !== 1 ? 's' : ''}</div>

            <div className="fm-complete-divider" />

            <p className="fm-complete-question">How was your focus?</p>
            <div className="fm-complete-moods">
              {MOODS.map((m) => (
                <button key={m.value} className={`fm-complete-mood ${selectedMood === m.value ? 'active' : ''}`} onClick={() => setSelectedMood(m.value)} type="button">{m.emoji}</button>
              ))}
            </div>

            <button className="fm-complete-save" onClick={saveSession} disabled={!selectedMood} type="button">Save Session</button>
          </div>
        </div>
      )}
    </div>
  )
}
