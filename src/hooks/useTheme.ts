// 🌗 Light, dark, or follow the operating system. The choice is a per-browser
// convenience, so it lives in localStorage; the resolved theme is written to
// <html data-theme> where the CSS tokens pick it up.

import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'savant-tracker:theme'

const readPreference = (): ThemePreference => {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference)
  const [system, setSystem] = useState<Theme>(systemTheme)

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return
    const onChange = () => setSystem(query.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const theme: Theme = preference === 'system' ? system : preference

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    // The installed app's title bar follows the top bar color.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#232930' : '#ffffff')
  }, [theme])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private windows throw; the choice still holds for this session.
    }
  }, [])

  const toggle = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [theme, setPreference])

  return { theme, preference, setPreference, toggle }
}
