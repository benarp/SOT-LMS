import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export type AdminContext = {
  user: User
  profile: { role: string; full_name: string | null; email: string }
  supabase: SupabaseClient
}

/**
 * Verifies the caller of a server action is an authenticated admin.
 * Server actions are publicly reachable endpoints — every action that
 * uses the service-role client MUST call this first.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Not authorized')
  return { user, profile, supabase }
}
