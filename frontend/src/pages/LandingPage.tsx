import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { IconBot } from '../components/icons'

/* â”€â”€ Content â”€â”€ */

const navLinks = [
  ['#system', 'Product'],
  ['#coach', 'AI Coach'],
  ['#exam', 'Exam Prep'],
  ['#how', 'How it works'],
]

const steps = [
  ['01', 'Create', 'Add subjects, exams and goals.'],
  ['02', 'Plan', 'Build a study plan around your schedule.'],
  ['03', 'Focus', 'Start a focused session.'],
]

const testimonials = [
  {
    quote: 'Flox turned my messy exam prep into a calm daily routine. I actually know what to study now.',
    name: 'Aisha K.',
    role: 'Computer Science',
  },
  {
    quote: 'The AI coach suggestion to revise weak topics before exams genuinely raised my scores.',
    name: 'Daniel R.',
    role: 'Med Student',
  },
  {
    quote: 'The focus timer and streak system keep me consistent. 40 days and counting.',
    name: 'Sara M.',
    role: 'Law Student',
  },
]

const weekDots = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55 } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
}

const reveal = (amount = 0.3) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount },
  transition: { duration: 0.6 },
})

/* â”€â”€ Component â”€â”€ */

export default function LandingPage() {
  return (
    <main className="landing-page">
      {/* â”€â”€ NAVBAR â”€â”€ */}
      <header className="ln-nav">
        <div className="ln-nav-inner">
          <Link className="ln-logo" to="/">
            <span className="ln-logo-mark"><IconBot size={18} /></span>
            <strong>FLOX AI</strong>
          </Link>

          <nav className="ln-nav-links" aria-label="Primary">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href}>{label}</a>
            ))}
          </nav>

          <div className="ln-nav-actions">
            <Link className="ln-nav-login" to="/login">Log in</Link>
            <Link className="ln-nav-cta" to="/register">Start for free</Link>
          </div>

          <button
            className="ln-menu-toggle"
            type="button"
            aria-label="Open menu"
            onClick={() => {
              const menu = document.getElementById('ln-mobile-menu')
              const open = menu?.classList.contains('open')
              menu?.classList.toggle('open', !open)
            }}
          >
            <span className="ln-burger" />
          </button>
        </div>

        <div className="ln-mobile-menu" id="ln-mobile-menu">
          {navLinks.map(([href, label]) => (
            <a key={href} href={href}>{label}</a>
          ))}
          <Link to="/login">Log in</Link>
          <Link className="ln-nav-cta" to="/register">Start for free</Link>
        </div>
      </header>

      {/* â”€â”€ HERO â”€â”€ */}
      <section className="ln-hero" id="top">
        <div className="ln-hero-glow" aria-hidden="true" />
        <div className="ln-container">
          <motion.div
            className="ln-hero-copy"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="ln-eyebrow">Your study, organized.</span>
            <h1>A smarter way to plan, focus &amp; learn.</h1>
            <p className="ln-hero-sub">
              FLOX AI brings your study plans, focus sessions, notes, quizzes, exams and AI
              coaching into one calm, intelligent place.
            </p>
            <div className="ln-hero-actions">
              <Link className="ln-btn ln-btn-primary" to="/register">Start for free</Link>
              <a className="ln-btn ln-btn-ghost" href="#system">See how it works</a>
            </div>
            <p className="ln-hero-note">{'\u2713'} No credit card required</p>
          </motion.div>

          {/* Product preview: realistic dashboard */}
          <motion.div
            className="ln-preview"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <div className="ln-window">
              <div className="ln-window-top">
                <span className="ln-window-dot red" />
                <span className="ln-window-dot yellow" />
                <span className="ln-window-dot green" />
                <span className="ln-window-url">app.focusflow.ai</span>
              </div>
              <div className="ln-window-body">
                <div className="ln-sidebar">
                  <span className="ln-sb-brand"><IconBot size={15} /> FF</span>
                  <span className="ln-sb-item active">{'\uD83C\uDFE0'} Dashboard</span>
                  <span className="ln-sb-item">{'\uD83D\uDCC5'} Planner</span>
                  <span className="ln-sb-item">{'\uD83D\uDCDA'} Subjects</span>
                  <span className="ln-sb-item">{'\u23F1\uFE0F'} Focus</span>
                  <span className="ln-sb-item">{'\uD83D\uDCCA'} Progress</span>
                  <span className="ln-sb-item ai">{'\u2726'} AI Coach</span>
                  <span className="ln-sb-item">{'\uD83D\uDCDD'} Notes</span>
                  <span className="ln-sb-item">{'\uD83E\uDDE0'} Quiz</span>
                  <span className="ln-sb-item">{'\uD83C\uDF93'} Exams</span>
                </div>
                <div className="ln-main">
                  <div className="ln-main-head">
                    <div>
                      <span className="ln-main-title">Good morning, Nihal {':)'}</span>
                      <span className="ln-main-sub">Your day at a glance</span>
                    </div>
                    <span className="ln-main-avatar">NI</span>
                  </div>
                  <div className="ln-kpis">
                    <span className="ln-kpi"><b>{'\uD83D\uDD25'} 18</b><i>streak</i></span>
                    <span className="ln-kpi"><b>{'\u23F1\uFE0F'} 2h35</b><i>studied</i></span>
                    <span className="ln-kpi"><b>{'\u2713'} 5/7</b><i>tasks</i></span>
                  </div>
                  <span className="ln-label">Today&apos;s plan</span>
                  <div className="ln-plan">
                    <span className="ln-plan-row">
                      <b>Mathematics <em>Integration</em></b><i>40m</i>
                    </span>
                    <span className="ln-plan-row">
                      <b>C++ <em>Constructors</em></b><i>30m</i>
                    </span>
                    <span className="ln-plan-row">
                      <b>Cyber Security <em>Module 2</em></b><i>25m</i>
                    </span>
                  </div>
                  <span className="ln-label">Your progress</span>
                  <div className="ln-progress-line">
                    <div className="ln-progress-track"><span style={{ width: '78%' }} /></div>
                    <b>78%</b>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ PROBLEM â”€â”€ */}
      <section className="ln-problem">
        <div className="ln-container">
          <motion.div className="ln-section-head" {...reveal(0.3)}>
            <span className="ln-eyebrow">The problem</span>
            <h2>Studying shouldn&apos;t feel this scattered</h2>
          </motion.div>
          <motion.div className="ln-problem-grid" {...reveal(0.3)}>
            <div className="ln-problem-list">
              <p>Your schedule is in one place.</p>
              <p>Your notes are somewhere else.</p>
              <p>Your exam dates get forgotten.</p>
              <p>Your progress is hard to understand.</p>
              <p className="ln-problem-why">
                And when you don&apos;t know what to study next, you waste time deciding.
              </p>
            </div>
            <div className="ln-problem-solution">
              <span className="ln-solution-arrow">{'\u2192'}</span>
              <h3>FLOX AI brings it all together.</h3>
              <div className="ln-flow">
                <span>PLAN</span>
                <b>{'\u2192'}</b>
                <span>FOCUS</span>
                <b>{'\u2192'}</b>
                <span>LEARN</span>
                <b>{'\u2192'}</b>
                <span>MEASURE</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ ONE STUDY SYSTEM (intro) â”€â”€ */}
      <section className="ln-system" id="system">
        <div className="ln-container">
          <motion.div className="ln-section-head" {...reveal(0.3)}>
            <span className="ln-eyebrow">One study system</span>
            <h2>One place for your entire study life</h2>
          </motion.div>
        </div>

        {/* 01 PLAN */}
        <motion.div className="ln-system-row" {...reveal(0.2)}>
          <div className="ln-container ln-system-inner">
            <div className="ln-system-text">
              <span className="ln-system-num">01</span>
              <h3>Plan</h3>
              <p>Know what to study before you sit down. Build schedules around your classes, tasks and exams.</p>
            </div>
            <div className="ln-shot">
              <div className="ln-shot-head">
                <span>Planner</span>
                <i>Today</i>
              </div>
              <div className="ln-shot-body">
                <span className="ln-shot-row"><b>Mathematics</b><i>40 min</i></span>
                <span className="ln-shot-row"><b>C++</b><i>30 min</i></span>
                <span className="ln-shot-row"><b>Cyber Security</b><i>25 min</i></span>
                <span className="ln-shot-row off"><b>Physics</b><i>{'\u2014'}</i></span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 02 FOCUS */}
        <motion.div className="ln-system-row alt" {...reveal(0.2)}>
          <div className="ln-container ln-system-inner">
            <div className="ln-shot">
              <div className="ln-shot-focus">
                <span className="ln-focus-display">48:32</span>
                <div className="ln-focus-track"><span /></div>
                <span className="ln-focus-subject">C++ &middot; Constructors</span>
                <span className="ln-focus-ctrl">{'\u2759\u2759'}</span>
              </div>
            </div>
            <div className="ln-system-text">
              <span className="ln-system-num">02</span>
              <h3>Focus</h3>
              <p>One session. One goal. No distractions. Start a session and FocusFlow gets out of your way.</p>
            </div>
          </div>
        </motion.div>

        {/* 03 LEARN */}
        <motion.div className="ln-system-row" {...reveal(0.2)}>
          <div className="ln-container ln-system-inner">
            <div className="ln-system-text">
              <span className="ln-system-num">03</span>
              <h3>Learn</h3>
              <p>Turn your notes into quizzes. Ask FLOX AI. Understand difficult topics faster.</p>
            </div>
            <div className="ln-shot">
              <div className="ln-shot-quiz">
                <span className="ln-quiz-top">C++ â€” Constructors <i>Question 4 of 10</i></span>
                <span className="ln-quiz-q">Which constructor is called when an object is copied?</span>
                <span className="ln-quiz-opt">A &nbsp;Copy constructor</span>
                <span className="ln-quiz-opt sel">B &nbsp;Default constructor</span>
                <span className="ln-quiz-opt">C &nbsp;Parameterized constructor</span>
                <span className="ln-quiz-opt">D &nbsp;Destructor</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 04 IMPROVE */}
        <motion.div className="ln-system-row alt" {...reveal(0.2)}>
          <div className="ln-container ln-system-inner">
            <div className="ln-shot">
              <div className="ln-shot-analy">
                <span className="ln-analy-head">Mathematics <i>Exam in 12 days</i></span>
                <span className="ln-label">Preparation</span>
                <div className="ln-progress-line">
                  <div className="ln-progress-track"><span style={{ width: '68%' }} /></div>
                  <b>68%</b>
                </div>
                <div className="ln-analy-cols">
                  <div>
                    <span className="ln-analy-title">Strong topics</span>
                    <span className="ln-analy-row"><i className="green" /> Algebra <b>91%</b></span>
                    <span className="ln-analy-row"><i className="green" /> Calculus <b>86%</b></span>
                  </div>
                  <div>
                    <span className="ln-analy-title">Needs attention</span>
                    <span className="ln-analy-row"><i className="orange" /> Integration <b>54%</b></span>
                    <span className="ln-analy-row"><i className="orange" /> Diff. Eq. <b>61%</b></span>
                  </div>
                </div>
              </div>
            </div>
            <div className="ln-system-text">
              <span className="ln-system-num">04</span>
              <h3>Improve</h3>
              <p>See what you&apos;re good at. Find weak areas. Know exactly what to study next.</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* â”€â”€ FLOX AI â”€â”€ */}
      <section className="ln-coach" id="coach">
        <div className="ln-container">
          <motion.div className="ln-coach-grid" {...reveal(0.3)}>
            <div className="ln-coach-copy">
              <span className="ln-eyebrow">{'\uD83E\uDDE0'} Meet Flox</span>
              <h2>Your study coach, built in.</h2>
              <p className="ln-coach-intro">
                FLOX doesn&apos;t just answer questions. It understands your subjects, study plan,
                quiz performance, upcoming exams and study history.
              </p>
              <ul className="ln-coach-list">
                <li>Your Mathematics exam is in 12 days.</li>
                <li>Your Integration accuracy is 54%.</li>
                <li>I recommend a 40-minute revision session today.</li>
              </ul>
            </div>
            <div className="ln-coach-card">
              <div className="ln-coach-head">
                <span className="ln-coach-avatar"><IconBot size={18} /></span>
                <strong>{'\u2726'} FLOX AI</strong>
                <span className="ln-coach-online" />
              </div>
              <div className="ln-coach-msg">
                <p>Good morning {':)'} You have a <b>Mathematics</b> exam in 12 days.</p>
                <p>Your <b>Integration</b> scores have dropped recently.</p>
                <p>I recommend a <b>40-minute</b> revision session today.</p>
              </div>
              <Link className="ln-btn ln-btn-primary ln-coach-btn" to="/register">
                Start Focus {'\u2192'}
              </Link>
              <p className="ln-coach-foot">FLOX helps you decide what&apos;s next.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ FOCUS MODE â”€â”€ */}
      <section className="ln-focus">
        <div className="ln-container">
          <motion.div className="ln-focus-dramatic" {...reveal(0.25)}>
            <span className="ln-eyebrow">{'\u23F1\uFE0F'} Focus mode</span>
            <h2>Focus without distractions</h2>
            <div className="ln-focus-timer">48:32</div>
            <div className="ln-focus-track ln-focus-track-lg"><span /></div>
            <span className="ln-focus-subject-sm">C++</span>
            <span className="ln-focus-topic">Constructors</span>
            <span className="ln-focus-ctrl-lg">{'\u2759\u2759'}</span>
            <p className="ln-focus-tagline">Just you and the work.{'\u00A0'}</p>
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ EXAM PREP â”€â”€ */}
      <section className="ln-exam" id="exam">
        <div className="ln-container">
          <motion.div className="ln-section-head" {...reveal(0.3)}>
            <span className="ln-eyebrow">{'\uD83C\uDF93'} Exam prep</span>
            <h2>Prepare with a plan</h2>
            <p>Stop guessing what to revise before an exam. FocusFlow combines your syllabus, progress and study history into a realistic preparation plan.</p>
          </motion.div>
          <motion.div className="ln-exam-card" {...reveal(0.3)}>
            <div className="ln-exam-head">
              <div>
                <span className="ln-exam-title">Mathematics</span>
                <span className="ln-exam-days">Exam in 12 days</span>
              </div>
              <span className="ln-exam-chip">Midterm</span>
            </div>
            <div className="ln-exam-pre">
              <span className="ln-label">Preparation</span>
              <div className="ln-progress-line">
                <div className="ln-progress-track"><span style={{ width: '68%' }} /></div>
                <b>68%</b>
              </div>
            </div>
            <div className="ln-exam-cols">
              <div>
                <span className="ln-analy-title">Strong topics</span>
                <span className="ln-analy-row"><i className="green" /> Algebra <b>91%</b></span>
                <span className="ln-analy-row"><i className="green" /> Calculus <b>86%</b></span>
              </div>
              <div>
                <span className="ln-analy-title">Needs attention</span>
                <span className="ln-analy-row"><i className="orange" /> Integration <b>54%</b></span>
                <span className="ln-analy-row"><i className="orange" /> Differential Eq. <b>61%</b></span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ AI QUIZZES â”€â”€ */}
      <section className="ln-quiz">
        <div className="ln-container">
          <div className="ln-quiz-grid">
            <motion.div className="ln-section-head left" {...reveal(0.3)}>
              <span className="ln-eyebrow">{'\uD83E\uDDE0'} AI quizzes</span>
              <h2>Learn by testing yourself</h2>
              <p>Create quizzes from what you&apos;re studying and see what sticks.</p>
              <Link className="ln-btn ln-btn-primary" to="/register">Try a quiz</Link>
            </motion.div>
            <motion.div className="ln-shot ln-shot-quiz-big" {...reveal(0.3)}>
              <span className="ln-quiz-top">C++ â€” Constructors <i>Question 4 of 10</i></span>
              <span className="ln-quiz-q">Which constructor is called when an object is copied?</span>
              <span className="ln-quiz-opt">A &nbsp;Copy constructor</span>
              <span className="ln-quiz-opt sel">B &nbsp;Default constructor</span>
              <span className="ln-quiz-opt">C &nbsp;Parameterized constructor</span>
              <span className="ln-quiz-opt">D &nbsp;Destructor</span>
              <span className="ln-quiz-next">Next {'\u2192'}</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* â”€â”€ PROGRESS + STREAK â”€â”€ */}
      <section className="ln-progress">
        <div className="ln-container">
          <div className="ln-progress-grid">
            <motion.div className="ln-section-head left" {...reveal(0.3)}>
              <span className="ln-eyebrow">{'\uD83D\uDCCA'} Progress</span>
              <h2>Your progress should tell a story</h2>
              <p>Small sessions become consistent habits. See the streak you&apos;re building, day by day.</p>
            </motion.div>
            <motion.div className="ln-progress-card" {...reveal(0.3)}>
              <div className="ln-streak">
                <strong>18</strong>
                <span>DAY STREAK</span>
                <em>{'\uD83D\uDD25'}</em>
              </div>
              <div className="ln-week">
                {weekDots.map((d, i) => (
                  <div className={`ln-week-day${i === 6 ? ' empty' : ''}`} key={d}>
                    <i />
                    <span>{d.slice(0, 1)}</span>
                  </div>
                ))}
              </div>
              <div className="ln-week-totals">
                <strong>8h 42m this week</strong>
                <span className="up">{'\u2191'} +23% from last week</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* â”€â”€ TESTIMONIALS â”€â”€ */}
      <section className="ln-testimonials">
        <div className="ln-container">
          <motion.div className="ln-section-head" {...reveal(0.3)}>
            <span className="ln-eyebrow">{'\uD83D\uDC4D'} Loved by students</span>
            <h2>Real students, real focus</h2>
          </motion.div>
          <motion.div className="ln-testimonial-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
            {testimonials.map((t) => (
              <motion.figure className="ln-testimonial" key={t.name} variants={fadeUp}>
                <span className="ln-t-quote">{'\u201C'}</span>
                <blockquote>{t.quote}</blockquote>
                <figcaption>
                  <span className="ln-t-avatar">{t.name[0]}</span>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ HOW IT WORKS â”€â”€ */}
      <section className="ln-how" id="how">
        <div className="ln-container">
          <motion.div className="ln-section-head" {...reveal(0.3)}>
            <span className="ln-eyebrow">How it works</span>
            <h2>Start in three steps</h2>
          </motion.div>
          <motion.div className="ln-how-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
            {steps.map(([num, title, text]) => (
              <motion.article className="ln-how-step" key={num} variants={fadeUp}>
                <span className="ln-step-num">{num}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ FINAL CTA â”€â”€ */}
      <section className="ln-cta">
        <div className="ln-container">
          <motion.div className="ln-cta-card" {...reveal(0.3)}>
            <span className="ln-eyebrow">Ready to focus?</span>
            <h2>Build a study system that works for you.</h2>
            <p>Start your study orbit.</p>
            <Link className="ln-btn ln-btn-primary ln-btn-lg" to="/register">
              Get started free {'\u2192'}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* â”€â”€ FOOTER â”€â”€ */}
      <footer className="ln-footer">
        <div className="ln-container">
          <div className="ln-footer-top">
            <div className="ln-footer-brand">
              <span className="ln-logo-mark"><IconBot size={18} /></span>
              <strong>FLOX AI</strong>
              <p>Your intelligent study workspace.</p>
            </div>
            <div className="ln-footer-cols">
              <div>
                <h4>Product</h4>
                <Link to="/">Dashboard</Link>
                <Link to="/">AI Coach</Link>
                <Link to="/">Focus Mode</Link>
                <Link to="/">Quiz</Link>
              </div>
              <div>
                <h4>Resources</h4>
                <Link to="/">Help</Link>
                <Link to="/">Blog</Link>
                <Link to="/">Guides</Link>
              </div>
              <div>
                <h4>Company</h4>
                <Link to="/">About</Link>
                <Link to="/">Contact</Link>
              </div>
              <div>
                <h4>Legal</h4>
                <Link to="/">Privacy</Link>
                <Link to="/">Terms</Link>
              </div>
            </div>
          </div>
          <div className="ln-footer-bottom">
            <span>&copy; {new Date().getFullYear()} FLOX AI</span>
            <span>Made for learners</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
