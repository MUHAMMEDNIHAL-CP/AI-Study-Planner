import { Link } from 'react-router-dom'
import { IconBot } from '../components/icons'

const orbitFeatures = [
  ['\uD83D\uDCDA', 'Organize', 'Subjects'],
  ['\uD83C\uDFAF', 'Plan', 'Smarter'],
  ['\u23F1\uFE0F', 'Focus', 'Deeper'],
  ['\uD83D\uDCCA', 'Track', 'Progress'],
]

const focusNodes = [
  { label: 'Subjects', icon: '\uD83D\uDCDA', pos: 'n-subject' },
  { label: 'Quizzes', icon: '\uD83E\uDDE0', pos: 'n-quiz' },
  { label: 'Exams', icon: '\uD83C\uDF93', pos: 'n-exam' },
  { label: 'Notes', icon: '\uD83D\uDCDD', pos: 'n-notes' },
  { label: 'Focus', icon: '\u23F1\uFE0F', pos: 'n-focus' },
  { label: 'Progress', icon: '\uD83D\uDCCA', pos: 'n-progress' },
]

const steps = [
  ['01', 'Create', 'Add subjects, exams and goals.'],
  ['02', 'Plan', 'Build your study plan.'],
  ['03', 'Focus', 'Start a focused session.'],
]

const weekDots = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link className="landing-logo" to="/">
            <span className="landing-logo-mark"><IconBot size={18} /></span>
            <strong>FocusFlow AI</strong>
          </Link>

          <nav className="landing-nav-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#coach">AI Coach</a>
            <a href="#progress">Progress</a>
            <Link className="landing-nav-login" to="/login">Log in</Link>
            <Link className="landing-nav-cta" to="/register">Get Started</Link>
          </nav>

          <button
            className="landing-menu-toggle"
            type="button"
            aria-label="Open menu"
            onClick={() => {
              const menu = document.getElementById('landing-mobile-menu')
              const open = menu?.classList.contains('open')
              menu?.classList.toggle('open', !open)
            }}
          >
            <span className="landing-burger" />
          </button>
        </div>

        <div className="landing-mobile-menu" id="landing-mobile-menu">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#coach">AI Coach</a>
          <a href="#progress">Progress</a>
          <Link to="/login">Log in</Link>
          <Link className="landing-nav-cta" to="/register">Get Started</Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="landing-hero" id="top">
        <div className="landing-hero-glow" aria-hidden="true" />
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              <span className="landing-eyebrow-dot" /> Your study in orbit
            </span>
            <h1>
              Your study.
              <br />
              In <em>orbit.</em>
            </h1>
            <p>
              Your AI-powered study space for planning, focus, quizzes, exams, notes and
              progress — all in one place.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-btn landing-btn-primary" to="/register">
                Start Studying — It&apos;s Free
              </Link>
            </div>
            <a className="landing-hero-scroll" href="#features">
              See how it works
              <span className="landing-scroll-arrow">{'\u2193'}</span>
            </a>
          </div>

          <div className="landing-orbit" aria-hidden="true">
            <span className="landing-orbit-ring ring-a" />
            <span className="landing-orbit-ring ring-b" />
            <span className="landing-orbit-line l1" />
            <span className="landing-orbit-line l2" />
            <span className="landing-orbit-line l3" />
            <div className="landing-orbit-core">
              <span className="landing-orbit-star">{'\u2726'}</span>
              <strong>FLOX&nbsp;AI</strong>
            </div>
            {focusNodes.map((n) => (
              <div className={`landing-orbit-mini ${n.pos}`} key={n.label}>
                <span>{n.icon}</span>
                <b>{n.label}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES (orbit) ── */}
      <section className="landing-features" id="features">
        <div className="landing-container">
          <div className="landing-section-head">
            <span className="landing-eyebrow">{'\u2726'} Your study orbit</span>
            <h2>Everything revolves around you</h2>
            <p>One calm place for planning, focus, quizzes, exams, notes and progress.</p>
          </div>

          <div className="landing-feature-orbit">
            <div className="landing-feature-grid">
              {orbitFeatures.slice(0, 2).map(([icon, a, b]) => (
                <article className="landing-feature-card" key={a}>
                  <span className="landing-feature-ico">{icon}</span>
                  <h3>{a}</h3>
                  <p>{b}</p>
                </article>
              ))}
            </div>

            <div className="landing-feature-core">
              <span className="landing-orbit-star">{'\u2726'}</span>
              <strong>FLOX&nbsp;AI</strong>
              <span>your co-pilot</span>
            </div>

            <div className="landing-feature-grid">
              {orbitFeatures.slice(2, 4).map(([icon, a, b]) => (
                <article className="landing-feature-card" key={a}>
                  <span className="landing-feature-ico">{icon}</span>
                  <h3>{a}</h3>
                  <p>{b}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI COACH ── */}
      <section className="landing-coach" id="coach">
        <div className="landing-container">
          <div className="landing-section-head">
            <span className="landing-eyebrow">{'\uD83E\uDDE0'} Meet Flox</span>
            <h2>Your AI study coach</h2>
            <p>
              Flox understands your subjects, progress, quizzes and upcoming exams to help you
              decide what to study next.
            </p>
          </div>

          <div className="landing-coach-card">
            <div className="landing-coach-head">
              <span className="landing-coach-avatar"><IconBot size={20} /></span>
              <strong>FLOX AI</strong>
            </div>
            <ul className="landing-coach-lines">
              <li>Your Mathematics exam is in 12 days.</li>
              <li>Your Integration accuracy is 54%.</li>
              <li>I recommend a 40-minute revision session today.</li>
            </ul>
            <Link className="landing-btn landing-btn-primary landing-coach-btn" to="/register">
              Start Focus {'\u2192'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOCUS MODE ── */}
      <section className="landing-focus">
        <div className="landing-container">
          <div className="landing-section-head">
            <span className="landing-eyebrow">{'\u23F1\uFE0F'} Focus mode</span>
            <h2>Focus without distractions</h2>
            <p>
              Start a session, put distractions away, and focus on one thing at a time.
            </p>
          </div>

          <div className="landing-focus-timer">
            <div className="landing-timer-display">48:32</div>
            <div className="landing-timer-bar"><span /></div>
            <div className="landing-timer-subject">C++ &middot; OOP</div>
            <div className="landing-timer-controls">
              <span className="landing-timer-control">{'\u2759\u2759'}</span>
            </div>
          </div>
          <p className="landing-focus-tagline">Just you and the work.</p>
        </div>
      </section>

      {/* ── QUIZ + EXAM ── */}
      <section className="landing-split">
        <div className="landing-container">
          <div className="landing-split-grid">
            <article className="landing-split-card">
              <span className="landing-split-ico">{'\uD83E\uDDE0'}</span>
              <h3>AI Quizzes</h3>
              <p>Turn your notes into personalized quizzes.</p>
              <Link className="landing-link" to="/register">Try a Quiz {'\u2192'}</Link>
            </article>
            <article className="landing-split-card">
              <span className="landing-split-ico">{'\uD83C\uDF93'}</span>
              <h3>Exam Prep</h3>
              <p>Know what to study before exam day.</p>
              <Link className="landing-link" to="/register">Plan My Exam {'\u2192'}</Link>
            </article>
          </div>
        </div>
      </section>

      {/* ── PROGRESS ── */}
      <section className="landing-progress" id="progress">
        <div className="landing-container">
          <div className="landing-progress-grid">
            <div className="landing-progress-copy">
              <span className="landing-eyebrow">{'\uD83D\uDCCA'} Your progress</span>
              <h2>See the streak you&apos;re building</h2>
              <p>Every session adds up. Watch your daily consistency grow.</p>
            </div>

            <div className="landing-progress-card">
              <div className="landing-streak">
                <strong>18</strong>
                <span>DAY STREAK</span>
                <em>{'\uD83D\uDD25'}</em>
              </div>
              <div className="landing-week">
                <span className="landing-week-label">This week</span>
                <div className="landing-week-dots">
                  {weekDots.map((d, i) => (
                    <div className={`landing-week-day${i === 6 ? ' empty' : ''}`} key={d}>
                      <i />
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="landing-progress-totals">
                <strong>8h 42m studied</strong>
                <span className="up">{'\u2191'} +23% this week</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="landing-how" id="how">
        <div className="landing-container">
          <div className="landing-section-head">
            <span className="landing-eyebrow">{'\u2726'} Your study orbit</span>
            <h2>How it works</h2>
          </div>

          <div className="landing-how-grid">
            {steps.map(([num, title, text]) => (
              <article className="landing-how-step" key={num}>
                <span className="landing-step-num">{num}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="landing-how-orbit">
            <span className="landing-orbit-star">{'\u2726'}</span>Your orbit starts here.
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="landing-cta">
        <div className="landing-container">
          <span className="landing-eyebrow">{'\u2726'} Ready to study?</span>
          <h2>Build your study orbit.</h2>
          <p>No credit card required. Free to start.</p>
          <div className="landing-cta-actions">
            <Link className="landing-btn landing-btn-primary" to="/register">
              Start Studying — It&apos;s Free
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-logo">
            <span className="landing-logo-mark"><IconBot size={17} /></span>
            <strong>FocusFlow AI</strong>
          </div>
          <p>&copy; {new Date().getFullYear()} FocusFlow AI. Study smarter, recover faster.</p>
        </div>
      </footer>
    </main>
  )
}
