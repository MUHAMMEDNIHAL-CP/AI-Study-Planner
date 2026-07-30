type IconProps = { className?: string; size?: number }

function base({ className, size = 20 }: IconProps) {
  return { className, width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
}

export function IconDashboard(props: IconProps) {
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

export function IconPlanner(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h2M8 18h6" />
    </svg>
  )
}

export function IconTutor(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M12 3c3.3 0 6 2.2 6 5.5S15.3 14 12 14 6 11.8 6 8.5 8.7 3 12 3Z" />
      <path d="M8 14.5 6 21h12l-2-6.5" />
      <path d="M9 8h.01M15 8h.01" />
    </svg>
  )
}

export function IconQuiz(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M8 6h13M8 12h13M8 18h9" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconFocus(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </svg>
  )
}

export function IconAnalytics(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  )
}

export function IconBurnout(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M12 21c4.4-3.2 7-6.6 7-10.5C19 6.5 16 4 12 4S5 6.5 5 10.5C5 14.4 7.6 17.8 12 21Z" />
      <path d="M12 11v3" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconSettings(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  )
}

export function IconSpark(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" />
    </svg>
  )
}

export function IconOrbit(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-24 12 12)" />
      <circle cx="19" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconChevron(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function IconLogout(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}
