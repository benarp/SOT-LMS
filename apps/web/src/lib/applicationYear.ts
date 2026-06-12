import { createAdminClient } from '@/lib/supabase/admin'

export type ApplicationYear = {
  id: string
  name: string
  applications_open_at: string | null
  applications_close_at: string | null
}

export type ApplicationCycle = {
  /** The year applications belong to: latest application window, falling
   *  back to the active year if no window was ever configured. */
  year: ApplicationYear | null
  isOpen: boolean
  opensAt: Date | null
  closesAt: Date | null
}

/**
 * Applications target the newest application cycle, NOT the active year —
 * next year's applications open in spring while the current year is still
 * running. Uses the service-role client so the public /apply landing page
 * works for signed-out visitors (RLS hides school_years from anon).
 */
export async function getApplicationCycle(): Promise<ApplicationCycle> {
  const admin = createAdminClient()
  const { data: years } = await admin
    .from('school_years')
    .select('id, name, applications_open_at, applications_close_at, is_active')

  const withWindow = (years ?? [])
    .filter(y => y.applications_open_at)
    .sort((a, b) => +new Date(b.applications_open_at!) - +new Date(a.applications_open_at!))

  const year = withWindow[0] ?? (years ?? []).find(y => y.is_active) ?? null
  if (!year) return { year: null, isOpen: false, opensAt: null, closesAt: null }

  const now = new Date()
  const opensAt = year.applications_open_at ? new Date(year.applications_open_at) : null
  const closesAt = year.applications_close_at ? new Date(year.applications_close_at) : null
  const isOpen = !!opensAt && opensAt <= now && (!closesAt || now <= closesAt)

  return {
    year: { id: year.id, name: year.name, applications_open_at: year.applications_open_at, applications_close_at: year.applications_close_at },
    isOpen,
    opensAt,
    closesAt,
  }
}
