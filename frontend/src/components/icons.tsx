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

export function IconUsers(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.2 3.2 0 0 1 0 7" />
      <path d="M21.5 20a6.5 6.5 0 0 0-5-6.3" />
    </svg>
  )
}

export function IconChart(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  )
}

export function IconFlame(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M12 22c4.4-3.3 7-6.7 7-10.6C19 6.4 15.8 4 12 4S5 6.4 5 11.4C5 15.3 7.6 18.7 12 22Z" />
      <path d="M12 13c.8-1.8.6-3.3-.5-4.8 1.6.6 2.4 2 2.4 3.8 1.4-1 2-2.3 1.8-4-1.2-.6-2-1.8-2.5-3.2-1.2 1-2 2.2-2.4 3.6-.8-1-.4-2.2.3-3.4C9.8 6.3 9 8.3 9.5 9.9" />
    </svg>
  )
}

export function IconBook(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6M8 11h4" />
    </svg>
  )
}

export function IconPuzzle(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M21 10.5V8h-4a2 2 0 0 1-2-2V2H9v4" />
      <path d="M9 6H5a2 2 0 0 0-2 2v4" />
      <path d="M9 12h-2a2 2 0 0 0 0 4h2" />
      <path d="M9 20h6a2 2 0 0 0 2-2v-4a2 2 0 0 1 2-2h.5a2 2 0 0 1 0 4h-1.5v4" />
    </svg>
  )
}

export function IconBrain(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M9.5 3A2.5 2.5 0 0 0 7 5.5V6a2 2 0 0 0-2.5 3.4A2.5 2.5 0 0 0 5 14a2 2 0 0 0 2 2.5V19a2.5 2.5 0 0 0 5 0v-.5" />
      <path d="M14.5 3A2.5 2.5 0 0 1 17 5.5V6a2 2 0 0 1 2.5 3.4A2.5 2.5 0 0 1 19 14a2 2 0 0 1-2 2.5V19a2.5 2.5 0 0 1-5 0" />
      <path d="M9.5 8h5M9.5 12h5" />
    </svg>
  )
}

export function IconTimer(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <circle cx="12" cy="13" r="7" />
      <path d="M9 2h6" />
      <path d="M12 9v4l2.5 1.5" />
    </svg>
  )
}

export function IconDevice(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <rect x="5" y="2" width="14" height="20" rx="2.5" />
      <path d="M9 18h6M10 5h4" />
    </svg>
  )
}

export function IconShield(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M12 2 4.5 5v6c0 5 3.2 8.6 7.5 10 4.3-1.4 7.5-5 7.5-10V5L12 2Z" />
      <path d="m9 11.5 2 2 4-4.5" />
    </svg>
  )
}

export function IconHealth(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M12 21s-7-4.6-9.3-9C1 8.5 3 5 6.5 5c2 0 3.5 1 4.5 2.6 1-1.6 2.5-2.6 4.5-2.6C19 5 21 8.5 22.3 12 20 16.4 12 21 12 21Z" />
    </svg>
  )
}

export function IconAudit(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M3 5h18v14H3z" />
      <path d="M3 9h18" />
      <path d="m7.5 14 1.5 1.5L12 12.5" />
    </svg>
  )
}

export function IconReport(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  )
}

export function IconDatabase(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  )
}

export function IconActivity(props: IconProps) {
  const p = base(props)
  return (
    <svg {...p}>
      <path d="M22 12h-4l-3 8-6-16-3 8H2" />
    </svg>
  )
}
