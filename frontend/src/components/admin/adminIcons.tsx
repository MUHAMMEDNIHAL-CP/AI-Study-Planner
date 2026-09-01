type IconProps = { className?: string; size?: number }

function base({ className, size = 20 }: IconProps) {
  return { className, width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
}

export function IconOverview(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  )
}

export function IconPulse(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M22 12h-4l-3 8-6-16-3 8H2" />
    </svg>
  )
}