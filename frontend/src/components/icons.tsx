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
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

export function IconSun(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

export function IconMoon(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
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

export function IconBot(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 3v4" />
      <path d="M9 4h6" />
      <path d="M2 11v5" />
      <path d="M22 11v5" />
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

export function IconNotes(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  )
}

export function IconCalendar(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <rect x="7" y="13" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="14" y="13" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" opacity={0.4} />
    </svg>
  )
}

export function IconSubject(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6M8 11h4" />
    </svg>
  )
}

export function IconTask(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

export function IconProgress(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
    </svg>
  )
}
