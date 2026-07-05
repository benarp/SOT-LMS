export type ThemePref = 'light' | 'dark' | 'system'

export const THEME_KEY = 'sot-theme'

// Inline script run before paint to set the .dark class with no flash.
// Keep this logic in sync with resolveDark below.
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`

export function resolveDark(pref: ThemePref): boolean {
  if (pref === 'dark') return true
  if (pref === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function getStoredPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'system'
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.classList.toggle('dark', resolveDark(pref))
}

export function setStoredPref(pref: ThemePref): void {
  try { localStorage.setItem(THEME_KEY, pref) } catch {}
  applyTheme(pref)
}
