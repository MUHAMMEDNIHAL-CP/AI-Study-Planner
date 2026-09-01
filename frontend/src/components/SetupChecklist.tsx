import { useNavigate } from 'react-router-dom'

export type SetupChecklistState = {
  accountDone: boolean
  subjectDone: boolean
  taskDone: boolean
  examDone: boolean
  focusDone: boolean
}

type Step = {
  key: keyof SetupChecklistState
  num: number
  title: string
  body: string
  to: string
  action: string
  doneText: string
}

function buildSteps(accountDone: boolean): Step[] {
  return [
    {
      key: 'accountDone',
      num: 1,
      title: 'Create your account',
      body: accountDone ? 'Done \u2014 synced across your devices.' : 'Create your account to get started.',
      to: '/profile',
      action: 'View profile',
      doneText: 'Done \u2014 synced across your devices.',
    },
    {
      key: 'subjectDone',
      num: 2,
      title: 'Add your subjects',
      body: 'Add the subjects you\u2019re currently studying.',
      to: '/subjects',
      action: 'Add subject',
      doneText: 'Subjects added.',
    },
    {
      key: 'taskDone',
      num: 3,
      title: 'Create your first task',
      body: 'Start organizing what you need to study.',
      to: '/tasks',
      action: 'Add task',
      doneText: 'First task created.',
    },
    {
      key: 'examDone',
      num: 4,
      title: 'Add an upcoming exam',
      body: 'Get reminders and an AI-powered preparation plan.',
      to: '/exams',
      action: 'Add exam',
      doneText: 'Exam added.',
    },
    {
      key: 'focusDone',
      num: 5,
      title: 'Start your first Focus session',
      body: 'Study continuously for 30 minutes to begin your study streak.',
      to: '/focus',
      action: 'Start Focus',
      doneText: 'First focus session complete.',
    },
  ]
}

export default function SetupChecklist({ state }: { state: SetupChecklistState }) {
  const navigate = useNavigate()
  const steps = buildSteps(state.accountDone)
  const doneCount = steps.filter((s) => state[s.key]).length
  const allDone = doneCount === steps.length
  const activeKey = steps.find((s) => !state[s.key])?.key ?? null

  if (allDone) {
    return (
      <section className="setup-ready">
        <div className="setup-ready-emoji">{'\u2726'}</div>
        <h2 className="setup-ready-title">Your study space is ready!</h2>
        <p className="setup-ready-body">
          You&apos;re all set. FLOX AI can now personalize your study recommendations based on your activity.
        </p>
        <button className="setup-ready-btn" onClick={() => navigate('/focus')} type="button">
          Start studying {'\u2192'}
        </button>
      </section>
    )
  }

  return (
    <section className="setup-card">
      <header className="setup-head">
        <span className="setup-title">Get started with FocusFlow</span>
        <span className="setup-count">{doneCount}/{steps.length}</span>
      </header>
      <p className="setup-sub">Complete these steps to set up your study workspace.</p>

      <ol className="setup-list">
        {steps.map((step) => {
          const done = state[step.key]
          const active = step.key === activeKey
          const cls = 'setup-row' + (done ? ' is-done' : '') + (active ? ' is-active' : '')
          return (
            <li key={step.key} className={cls}>
              <button className="setup-row-main" onClick={() => navigate(step.to)} type="button" aria-label={`${step.title} steps`}>
                <span className={'setup-badge' + (done ? ' done' : '')}>
                  {done ? '\u2713' : step.num}
                </span>
                <span className="setup-row-text">
                  <strong>{step.title}</strong>
                  <small>{done ? step.doneText : step.body}</small>
                </span>
              </button>
              {active && (
                <button className="setup-action" onClick={() => navigate(step.to)} type="button">
                  {step.action} {'\u2192'}
                </button>
              )}
            </li>
          )
        })}
      </ol>

      <div className="setup-flox">
        <div className="setup-flox-head">
          <span className="setup-flox-icon">{'\u2726'}</span>
          <strong className="setup-flox-title">FLOX AI</strong>
        </div>
        <p className="setup-flox-text">
          Not sure where to start? FLOX can build your first study plan using your subjects and available time.
        </p>
        <button className="setup-flox-btn" onClick={() => navigate('/ai-tutor')} type="button">
          Ask FLOX {'\u2192'}
        </button>
      </div>
    </section>
  )
}
