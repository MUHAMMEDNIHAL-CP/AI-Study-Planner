import { Link } from 'react-router-dom'
import { IconOrbit, IconSpark } from '../components/icons'

const flowSteps = [
  ['Plan', 'Add subjects, exams, and tasks in one workspace.'],
  ['Focus', 'Run timed deep-work sessions with a calm timer UI.'],
  ['Recall', 'Generate quizzes from weak topics and score instantly.'],
  ['Recover', 'Check burnout risk and get a lighter timetable.'],
]

const proof = [
  ['One workspace', 'Planner, tutor, quiz, analytics together'],
  ['No API keys needed', 'Mock AI works out of the box'],
  ['Guided daily flow', 'Dashboard tells you what to do next'],
  ['Burnout-aware', 'Workload adjusts before you crash'],
]

export default function LandingPage() {
  return (
    <main className="landing-orbit-page">
      <header className="landing-orbit-nav">
        <div className="landing-brand">
          <span className="landing-brand-mark"><IconOrbit size={20} /></span>
          <strong>Flox AI AI</strong>
        </div>
        <nav>
          <a href="#flow">How it works</a>
          <a href="#proof">Why students use it</a>
          <Link to="/login">Log in</Link>
        </nav>
        <Link className="gradient-action" to="/register">Start free</Link>
      </header>

      <section className="landing-hero-grid">
        <div className="landing-hero-copy">
          <span className="eyebrow">AI Study Planner</span>
          <h1>One calm place for your entire <em>exam season</em></h1>
          <p>
            Flox AI turns messy study goals into a guided orbit — plan your week, focus deeply,
            practice with quizzes, and catch burnout before it hits.
          </p>
          <div className="landing-hero-actions">
            <Link className="gradient-action" to="/register">Create your workspace</Link>
            <Link className="ghost-action" to="/login">I already have an account</Link>
          </div>
        </div>

        <div className="landing-orbit-visual" aria-hidden="true">
          <span className="orbit-ring outer" />
          <span className="orbit-ring inner" />
          <article className="orbit-core">
            <span>Today&apos;s focus</span>
            <strong>47m</strong>
            <span>3 tasks · 1 quiz · streak 8</span>
          </article>
          <article className="orbit-node one"><b>Next</b>Organic Chemistry</article>
          <article className="orbit-node two"><b>Exam</b>12 days left</article>
          <article className="orbit-node three"><b>Coach</b>Take a 10m break</article>
        </div>
      </section>

      <section className="landing-flow-section" id="flow">
        <span className="eyebrow">How it works</span>
        <h2>Your study loop, designed for real students</h2>
        <p>Not another generic to-do app — Flox AI follows the rhythm exams actually demand.</p>
        <div className="landing-flow-grid">
          {flowSteps.map(([title, text], index) => (
            <article className="landing-flow-card" key={title}>
              <b>{index + 1}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-proof-section" id="proof">
        <span className="eyebrow"><IconSpark size={14} /> Built for MVP clarity</span>
        <h2>Everything in the PRD, nothing you do not need</h2>
        <div className="landing-proof-grid">
          {proof.map(([title, text]) => (
            <article key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta-band">
        <h2>Ready to enter your study orbit?</h2>
        <p>Register once, add a subject, and let Flox AI guide your next move.</p>
        <Link className="gradient-action" to="/register">Get started — it&apos;s free</Link>
      </section>
    </main>
  )
}
