import { Link } from 'react-router-dom'
import { IconBot } from '../components/icons'

const features = [
  {
    icon: '\uD83D\uDDD2\uFE0F',
    title: 'Plan your week',
    text: 'Add subjects, exams and tasks in one calm workspace. Flox turns goals into a clear daily roadmap.',
  },
  {
    icon: '\u23F1\uFE0F',
    title: 'Focus deeply',
    text: 'Run timed deep-work sessions with a distraction-free timer that keeps you in the zone.',
  },
  {
    icon: '\uD83C\uDFAF',
    title: 'Quiz to recall',
    text: 'Generate quizzes straight from your weak topics and watch your scores climb every session.',
  },
  {
    icon: '\uD83D\uDCA1',
    title: 'Stay burnout-aware',
    text: 'Flox reads your load and adjusts the timetable before the burnout ever hits.',
  },
]

const stats = [
  ['Plan', 'Everything in one place'],
  ['Focus', 'Distraction-free timers'],
  ['Recall', 'Quizzes from weak topics'],
  ['Recover', 'Smart burnout detection'],
]

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link className="landing-logo" to="/">
            <span className="landing-logo-mark"><IconBot size={19} /></span>
            <strong>Flox AI</strong>
          </Link>
          <nav className="landing-nav-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <Link to="/login">Log in</Link>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-glow" aria-hidden="true" />
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <span className="landing-badge">Your study co-pilot</span>
            <h1>
              Ace your <em>exam season</em> without the burnout
            </h1>
            <p>
              Flox AI turns messy study goals into a guided orbit — plan your week, focus deeply,
              quiz yourself, and recover before you crash.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-btn landing-btn-primary" to="/register">Get started free</Link>
              <Link className="landing-btn landing-btn-ghost" to="/login">I already have an account</Link>
            </div>
            <ul className="landing-hero-points">
              <li>Free to start</li>
              <li>No API keys needed</li>
              <li>Works on any device</li>
            </ul>
          </div>

          <div className="landing-orbit" aria-hidden="true">
            <span className="landing-orbit-ring r1" />
            <span className="landing-orbit-ring r2" />
            <span className="landing-orbit-ring r3" />
            <div className="landing-orbit-core">
              <span className="landing-orbit-day">Today&apos;s focus</span>
              <strong>47m</strong>
              <span className="landing-orbit-meta">3 tasks &middot; 1 quiz &middot; streak 8</span>
            </div>
            <div className="landing-orbit-chip c1"><b>Next</b>Organic Chem</div>
            <div className="landing-orbit-chip c2"><b>Exam</b>12 days left</div>
            <div className="landing-orbit-chip c3"><b>Coach</b>Take a 10m break</div>
          </div>
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-container">
          <div className="landing-section-head">
            <h2>Everything you need, nothing you don&apos;t</h2>
            <p>Four simple tools that work together to get you through exams the right way.</p>
          </div>
          <div className="landing-features-grid">
            {features.map((f) => (
              <article className="landing-feature" key={f.title}>
                <span className="landing-feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-how" id="how">
        <div className="landing-container">
          <div className="landing-section-head">
            <h2>Built around how you actually study</h2>
            <p>A loop that fits the rhythm exams really demand.</p>
          </div>
          <ul className="landing-steps">
            {stats.map(([title, text], i) => (
              <li key={title}>
                <span className="landing-step-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-container">
          <h2>Ready to enter your study orbit?</h2>
          <p>Register once, add a subject, and let Flox AI guide your next move.</p>
          <div className="landing-cta-actions">
            <Link className="landing-btn landing-btn-primary" to="/register">Create free account</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-logo">
            <span className="landing-logo-mark"><IconBot size={18} /></span>
            <strong>Flox AI</strong>
          </div>
          <p>&copy; {new Date().getFullYear()} Flox AI. Study smarter, recover faster.</p>
        </div>
      </footer>
    </main>
  )
}
