import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

const segments = [
  { label: 'Deep Focus', seconds: 25 * 60, mood: 'Study block' },
  { label: 'Power Flow', seconds: 50 * 60, mood: 'Long session' },
  { label: 'Reset Break', seconds: 5 * 60, mood: 'Recovery' },
]

type Segment = (typeof segments)[number]

type Ambience = {
  name: string
  volume: number
  enabled: boolean
  tone: 'lofi' | 'rain' | 'noise'
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function phaseFor(secondsLeft: number) {
  const cycle = secondsLeft % 12
  if (cycle > 7) return 'Breathe In'
  if (cycle > 5) return 'Hold'
  return 'Breathe Out'
}

export default function FocusModePage() {
  const [activeSegment, setActiveSegment] = useState<Segment>(segments[0])
  const [running, setRunning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(activeSegment.seconds)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [focusMinutes, setFocusMinutes] = useState(0)
  const [sessionNote, setSessionNote] = useState('Ready when you are.')
  const [ambience, setAmbience] = useState<Ambience[]>([
    { name: 'Lo-fi Pulse', volume: 42, enabled: false, tone: 'lofi' },
    { name: 'Soft Rain', volume: 28, enabled: false, tone: 'rain' },
    { name: 'White Noise', volume: 36, enabled: false, tone: 'noise' },
  ])
  const audioContext = useRef<AudioContext | null>(null)
  const ambientCleanup = useRef<(() => void) | null>(null)
  const progress = ((activeSegment.seconds - secondsLeft) / activeSegment.seconds) * 100
  const breathingPhase = running ? phaseFor(secondsLeft) : 'Ready'

  const getAudioContext = useCallback(() => {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return null
    audioContext.current ??= new AudioContextClass()
    return audioContext.current
  }, [])

  const playChime = useCallback(() => {
    const context = getAudioContext()
    if (!context) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 740
    gain.gain.value = 0.08
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.24)
  }, [getAudioContext])

  const completeSession = useCallback(() => {
    setRunning(false)
    setCompletedSessions((current) => current + 1)
    setFocusMinutes((current) => current + Math.round(activeSegment.seconds / 60))
    setSessionNote(`${activeSegment.label} complete. Take a breath before the next block.`)
    playChime()
  }, [activeSegment.label, activeSegment.seconds, playChime])

  const startAmbience = useCallback(() => {
    const context = getAudioContext()
    if (!context) return null
    const cleanups: Array<() => void> = []

    ambience.filter((sound) => sound.enabled && sound.volume > 0).forEach((sound) => {
      const gain = context.createGain()
      gain.gain.value = sound.volume / 450
      gain.connect(context.destination)

      if (sound.tone === 'lofi') {
        const oscillator = context.createOscillator()
        oscillator.type = 'sine'
        oscillator.frequency.value = 174
        oscillator.connect(gain)
        oscillator.start()
        cleanups.push(() => oscillator.stop())
        return
      }

      const bufferSize = context.sampleRate * 2
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let index = 0; index < bufferSize; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (sound.tone === 'rain' ? 0.28 : 0.5)
      }
      const source = context.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(gain)
      source.start()
      cleanups.push(() => source.stop())
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [ambience, getAudioContext])

  useEffect(() => {
    if (!running) return undefined
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          completeSession()
          return activeSegment.seconds
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [activeSegment.seconds, completeSession, running])

  useEffect(() => {
    ambientCleanup.current?.()
    ambientCleanup.current = null

    if (!running) return undefined
    ambientCleanup.current = startAmbience()

    return () => {
      ambientCleanup.current?.()
      ambientCleanup.current = null
    }
  }, [running, startAmbience])

  function resetSession() {
    setRunning(false)
    setSecondsLeft(activeSegment.seconds)
    setSessionNote('Session reset.')
  }

  function changeSegment(segment: Segment) {
    setActiveSegment(segment)
    setSecondsLeft(segment.seconds)
    setRunning(false)
    setSessionNote(`${segment.label} selected.`)
  }

  function toggleRunning() {
    setRunning((current) => {
      const next = !current
      setSessionNote(next ? `${activeSegment.label} started.` : 'Paused. Keep the next action small.')
      return next
    })
  }

  return (
    <div className="flow-page focus-mode-page">
      <header className="focus-top">
        <div>
          <span className="eyebrow">Pomodoro breathing companion</span>
          <h1>Focus Mode</h1>
        </div>
        <div className="flow-user">Flow Session <b /></div>
      </header>

      <section className="focus-workspace">
        <main className="page-card focus-timer-card">
          <div
            className={`mega-timer ${running ? 'breathing-active' : ''}`}
            style={{ '--timer-progress': `${progress}%` } as CSSProperties}
          >
            <div>
              <strong>{formatTime(secondsLeft)}</strong>
              <span>{breathingPhase}</span>
            </div>
          </div>

          <div className="segment-tabs focus-segments">
            {segments.map((segment) => (
              <button
                className={segment.label === activeSegment.label ? 'active' : ''}
                key={segment.label}
                onClick={() => changeSegment(segment)}
                type="button"
              >
                <strong>{segment.label}</strong>
                <span>{Math.round(segment.seconds / 60)} min</span>
              </button>
            ))}
          </div>

          <div className="focus-controls">
            <button className="round-control" onClick={resetSession} type="button">Reset</button>
            <button className="gradient-action start-flow" onClick={toggleRunning} type="button">
              {running ? 'Pause Flow' : 'Start Flow'}
            </button>
          </div>
        </main>

        <aside className="focus-session-panel">
          <section className="page-card focus-status-card">
            <h2>Session Status</h2>
            <div className="focus-stat-grid">
              <article><span>Mode</span><strong>{activeSegment.mood}</strong></article>
              <article><span>Done</span><strong>{completedSessions}</strong></article>
              <article><span>Logged</span><strong>{focusMinutes}m</strong></article>
              <article><span>Progress</span><strong>{Math.round(progress)}%</strong></article>
            </div>
            <p>{sessionNote}</p>
          </section>

          <section className="page-card focus-breath-card">
            <h2>Breathing Guide</h2>
            <div className={`breath-orb ${running ? 'active' : ''}`} />
            <strong>{breathingPhase}</strong>
            <span>4 seconds in, 2 hold, 6 out</span>
          </section>
        </aside>
      </section>

      <section className="ambience-grid">
        {ambience.map((item, index) => (
          <article className={`page-card ambience-card ${item.enabled ? 'enabled' : ''}`} key={item.name}>
            <div className="ambience-card-head">
              <div>
                <h3>{item.name}</h3>
                <span>{item.volume}%</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setAmbience((current) =>
                    current.map((sound, soundIndex) =>
                      soundIndex === index ? { ...sound, enabled: !sound.enabled } : sound,
                    ),
                  )
                }
              >
                {item.enabled ? 'On' : 'Off'}
              </button>
            </div>
            <input
              aria-label={`${item.name} volume`}
              max="100"
              min="0"
              type="range"
              value={item.volume}
              onChange={(event) =>
                setAmbience((current) =>
                  current.map((sound, soundIndex) =>
                    soundIndex === index ? { ...sound, volume: Number(event.target.value) } : sound,
                  ),
                )
              }
            />
            <div className="focus-ambience-meter"><i style={{ width: `${item.volume}%` }} /></div>
          </article>
        ))}
      </section>
    </div>
  )
}
