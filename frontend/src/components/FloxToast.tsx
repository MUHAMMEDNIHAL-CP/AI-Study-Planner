import { toast } from 'react-toastify'

type FloxToastProps = {
  kind: 'success' | 'error' | 'info'
  title?: string
  message: string
  toastId: string
}

const ICONS = {
  success: '\u2713',
  error: '\u00D7',
  info: 'i',
}

function FloxToast({ kind, title, message, toastId }: FloxToastProps) {
  return (
    <div className="flox-toast" role="status">
      <span className={`flox-toast-ico ${kind}`}>{ICONS[kind]}</span>
      <div className="flox-toast-body">
        <strong>{title ?? kind[0].toUpperCase() + kind.slice(1)}</strong>
        <p>{message}</p>
      </div>
      <button className="flox-toast-close" type="button" onClick={() => toast.dismiss(toastId)} aria-label="Dismiss">
        {'\uD835\uDD4F'}
      </button>
    </div>
  )
}

function push(kind: FloxToastProps['kind'], message: string, title?: string) {
  const toastId = `flox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  toast(<FloxToast kind={kind} title={title} message={message} toastId={toastId} />, {
    className: `flox-toast-slot ${kind}`,
    toastId,
    type: kind,
  })
}

export const floxToast = {
  success: (message: string, title?: string) => push('success', message, title),
  error: (message: string, title?: string) => push('error', message, title),
  info: (message: string, title?: string) => push('info', message, title),
  warn: (message: string, title?: string) => push('info', message, title),
  dismiss: () => toast.dismiss(),
}