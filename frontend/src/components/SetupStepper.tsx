type Step = {
  id: string
  label: string
  title: string
  detail: string
  done: boolean
  active?: boolean
}

type SetupStepperProps = {
  steps: Step[]
  onStepClick?: (id: string) => void
}

export default function SetupStepper({ steps, onStepClick }: SetupStepperProps) {
  const completed = steps.filter((step) => step.done).length
  const progress = Math.round((completed / steps.length) * 100)

  return (
    <section className="setup-stepper">
      <div className="setup-stepper-head">
        <div>
          <span className="eyebrow">Guided setup</span>
          <h2>Build your study orbit</h2>
        </div>
        <div className="setup-stepper-progress">
          <strong>{progress}%</strong>
          <span>{completed} of {steps.length} ready</span>
        </div>
      </div>
      <div className="setup-stepper-track">
        {steps.map((step, index) => (
          <button
            className={`setup-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}
            key={step.id}
            onClick={() => onStepClick?.(step.id)}
            type="button"
          >
            <b>{step.done ? '✓' : index + 1}</b>
            <div>
              <span>{step.label}</span>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
