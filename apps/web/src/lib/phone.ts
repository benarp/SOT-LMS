// Phone numbers reach us from two places with no agreed format: the Align roster
// import (profiles.phone) and the apply flow (applications.phone). Format
// defensively and fall back to showing exactly what is on file.

function digitsOf(raw: string): string {
  return raw.replace(/\D/g, '')
}

export function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const digits = digitsOf(trimmed)
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (local.length !== 10) return trimmed

  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
}

// An `sms:` href opens the phone's (or Mac's) messaging app with the recipient
// filled in. Returns null when the stored value isn't a number we can dial, so
// callers can render plain text rather than a dead link.
export function smsHref(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = digitsOf(raw)

  if (digits.length === 10) return `sms:+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `sms:+${digits}`
  // Already international, e.g. "+44 7700 900123".
  if (raw.trim().startsWith('+') && digits.length >= 11 && digits.length <= 15) return `sms:+${digits}`
  return null
}
