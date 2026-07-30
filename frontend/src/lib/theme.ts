export type ThemeMode = 'dark' | 'light'

export function getTheme(): ThemeMode {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('theme', theme)
}

export function toggleTheme(): ThemeMode {
  const next = getTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  return next
}
