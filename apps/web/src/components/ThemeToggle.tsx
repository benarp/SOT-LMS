'use client'

import { useEffect, useState } from 'react'
import { type ThemePref, getStoredPref, setStoredPref, applyTheme } from '@/lib/theme'

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>('system')

  // Read the stored preference after mount (localStorage is client-only).
  useEffect(() => { setPref(getStoredPref()) }, [])

  // While on "system", follow live OS theme changes.
  useEffect(() => {
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  function choose(next: ThemePref) {
    setPref(next)
    setStoredPref(next)
  }

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {OPTIONS.map(opt => {
        const active = pref === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => choose(opt.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
