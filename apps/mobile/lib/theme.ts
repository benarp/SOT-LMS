import { createContext, useContext } from 'react'
import { ColorSchemeName } from 'react-native'

export type ThemePref = 'light' | 'dark' | 'system'
export const THEME_KEY = 'sot-theme'

export type ThemeColors = {
  background: string
  surface: string
  border: string
  borderSubtle: string
  borderStrong: string
  text: string
  textSecondary: string
  textMuted: string
  textFaint: string
  accent: string
  accentText: string
  placeholder: string
  danger: string
  dangerBg: string
  dangerBorder: string
  success: string
  successBg: string
  successBorder: string
  successSoftBg: string
  successSoftText: string
  warning: string
  warningStrong: string
  warningBg: string
  warningBorder: string
  info: string
  infoStrong: string
  infoBg: string
  videoBg: string
}

// Light values match what was previously hardcoded across the app.
export const LIGHT: ThemeColors = {
  background: '#f9fafb',
  surface: '#ffffff',
  border: '#e5e7eb',
  borderSubtle: '#f3f4f6',
  borderStrong: '#d1d5db',
  text: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  accent: '#111827',
  accentText: '#ffffff',
  placeholder: '#9ca3af',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  dangerBorder: '#fecaca',
  success: '#16a34a',
  successBg: '#f0fdf4',
  successBorder: '#bbf7d0',
  successSoftBg: '#d1fae5',
  successSoftText: '#047857',
  warning: '#f59e0b',
  warningStrong: '#b45309',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  info: '#3b82f6',
  infoStrong: '#1e40af',
  infoBg: '#eff6ff',
  videoBg: '#000000',
}

// Dark values invert the same way the web app's theme does: the page
// background is darkest, cards sit one step lighter, and the "gray-900"
// accent (buttons, checkboxes, progress fill) flips to a light pill with
// dark text rather than staying near-black-on-black.
export const DARK: ThemeColors = {
  background: '#0a0a0b',
  surface: '#17171a',
  border: '#2e2e33',
  borderSubtle: '#232327',
  borderStrong: '#3f3f46',
  text: '#f5f5f7',
  textSecondary: '#dcdce2',
  textMuted: '#a1a1ab',
  textFaint: '#8e8e98',
  accent: '#f5f5f7',
  accentText: '#17171a',
  placeholder: '#8e8e98',
  danger: '#f87171',
  dangerBg: '#3f1d1d',
  dangerBorder: '#5b2323',
  success: '#4ade80',
  successBg: '#0f2b1c',
  successBorder: '#14532d',
  successSoftBg: '#0f3d2a',
  successSoftText: '#4ade80',
  warning: '#fbbf24',
  warningStrong: '#fbbf24',
  warningBg: '#3f2d0a',
  warningBorder: '#78350f',
  info: '#60a5fa',
  infoStrong: '#93c5fd',
  infoBg: '#1e3a5f',
  videoBg: '#000000',
}

export function resolveScheme(pref: ThemePref, systemScheme: ColorSchemeName): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref
  return systemScheme === 'dark' ? 'dark' : 'light'
}

export type ThemeContextValue = {
  colors: ThemeColors
  scheme: 'light' | 'dark'
  pref: ThemePref
  setPref: (pref: ThemePref) => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  colors: LIGHT,
  scheme: 'light',
  pref: 'system',
  setPref: () => {},
})

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
