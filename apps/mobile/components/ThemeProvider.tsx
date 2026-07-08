import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Appearance } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ThemeContext, THEME_KEY, LIGHT, DARK, resolveScheme, type ThemePref } from '../lib/theme'

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('system')
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme())
  const [loaded, setLoaded] = useState(false)

  // Load the saved per-device preference once at startup.
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setPrefState(stored)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // Follow live OS theme changes while set to "system".
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme))
    return () => sub.remove()
  }, [])

  function setPref(next: ThemePref) {
    setPrefState(next)
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {})
  }

  const scheme = resolveScheme(pref, systemScheme)
  const colors = scheme === 'dark' ? DARK : LIGHT

  const value = useMemo(() => ({ colors, scheme, pref, setPref }), [colors, scheme, pref])

  // Avoid a flash of the default (light) theme before the stored pref loads.
  if (!loaded) return null

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
