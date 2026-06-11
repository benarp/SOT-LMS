'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const IMPERSONATION_COOKIE = 'sot-impersonation'
const ADMIN_SESSION_COOKIE = 'sot-admin-session'

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60, // impersonation sessions expire after an hour
}

export type ImpersonationState = {
  studentEmail: string
  studentName: string
  adminEmail: string
  startedAt: string
}

export async function generateImpersonationLink(
  studentEmail: string,
  studentName: string
): Promise<{ link?: string; error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Not authorized' }
  }

  // Capture the admin's session so "Exit" can restore it — signing in as
  // the student replaces the auth cookies for the whole browser.
  const { data: { session } } = await admin.supabase.auth.getSession()
  if (!session) return { error: 'No active admin session' }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: studentEmail,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'}/auth/callback`,
    },
  })
  if (error) return { error: error.message }

  const cookieStore = await cookies()
  const state: ImpersonationState = {
    studentEmail,
    studentName,
    adminEmail: admin.profile.email,
    startedAt: new Date().toISOString(),
  }
  cookieStore.set(IMPERSONATION_COOKIE, JSON.stringify(state), cookieOptions)
  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
    cookieOptions
  )

  await logAudit({
    actor_id: admin.user.id,
    actor_email: admin.profile.email,
    action: 'impersonation_start',
    target_type: 'user',
    target_id: studentEmail,
  })

  return { link: data.properties.action_link }
}

export async function getImpersonationState(): Promise<ImpersonationState | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as ImpersonationState
  } catch {
    return null
  }
}

export async function endImpersonation(): Promise<void> {
  const cookieStore = await cookies()
  const stateRaw = cookieStore.get(IMPERSONATION_COOKIE)?.value
  const backupRaw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (stateRaw && user) {
    try {
      const state = JSON.parse(stateRaw) as ImpersonationState
      await logAudit({
        actor_id: user.id,
        actor_email: state.adminEmail,
        action: 'impersonation_end',
        target_type: 'user',
        target_id: state.studentEmail,
      })
    } catch {}
  }

  cookieStore.delete(IMPERSONATION_COOKIE)
  cookieStore.delete(ADMIN_SESSION_COOKIE)

  let restored = false
  if (backupRaw) {
    try {
      const { access_token, refresh_token } = JSON.parse(backupRaw)
      const { error } = await supabase.auth.setSession({ access_token, refresh_token })
      restored = !error
    } catch {
      restored = false
    }
  }

  if (!restored) {
    await supabase.auth.signOut()
    redirect('/login')
  }
  redirect('/admin/students')
}
