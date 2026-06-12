'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Curriculum ──────────────────────────────────────────────

export async function addWeek(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const schoolYearId = formData.get('schoolYearId') as string
  const weekNumber = parseInt(formData.get('weekNumber') as string)
  const title = formData.get('title') as string
  const dueDate = formData.get('dueDate') as string

  const { error } = await supabase.from('weeks').insert({
    school_year_id: schoolYearId,
    week_number: weekNumber,
    title,
    due_date: new Date(dueDate).toISOString(),
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/curriculum')
  return {}
}

export async function addHomeworkItem(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const weekId = formData.get('weekId') as string
  let type = formData.get('type') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const externalUrl = formData.get('externalUrl') as string
  const content = formData.get('content') as string
  const bookId = formData.get('bookId') as string
  const sortOrder = parseInt(formData.get('sortOrder') as string)

  // Book-linked reflections keep the dedicated type so the existing
  // auto-marking flow (saving a book reflection completes the item) works
  if (type === 'reflection' && bookId) type = 'book_reflection'

  const { error } = await supabase.from('homework_items').insert({
    week_id: weekId,
    type,
    title,
    description: description || null,
    external_url: externalUrl || null,
    content: content || null,
    book_id: bookId || null,
    sort_order: sortOrder,
  })

  if (error) return { error: error.message }
  revalidatePath(`/admin/curriculum/${weekId}`)
  return {}
}

export async function updateHomeworkItem(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const itemId = formData.get('itemId') as string
  const weekId = formData.get('weekId') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const externalUrl = formData.get('externalUrl') as string
  const content = formData.get('content') as string

  const { error } = await supabase.from('homework_items').update({
    title,
    description: description || null,
    external_url: externalUrl || null,
    content: content || null,
  }).eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/admin/curriculum/${weekId}`)
  return {}
}

export async function deleteHomeworkItem(itemId: string, weekId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Completion records cascade with the item — block the delete once students
  // have marked it done so a school year of data can't vanish on a misclick.
  const { count } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('homework_item_id', itemId)
  if (count && count > 0) {
    return { error: `${count} student${count === 1 ? ' has' : 's have'} completed this item. Deleting it would erase their records — edit the item instead.` }
  }

  const { error } = await supabase.from('homework_items').delete().eq('id', itemId)
  if (error) return { error: error.message }
  revalidatePath(`/admin/curriculum/${weekId}`)
  return {}
}

// ── Announcements ───────────────────────────────────────────

export async function createAnnouncement(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const title = formData.get('title') as string
  const body = formData.get('body') as string

  const { error } = await supabase.from('announcements').insert({
    created_by: user.id,
    title,
    body,
    publish_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/announcements')
  return {}
}

export async function deleteAnnouncement(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/announcements')
  return {}
}

// ── Students ────────────────────────────────────────────────

export async function inviteStudent(formData: FormData): Promise<{ error?: string }> {
  const { ctx, error: authError } = await guard()
  if (!ctx) return { error: authError }

  const adminClient = getAdminClient()
  const email = formData.get('email') as string
  const fullName = formData.get('fullName') as string

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'}/auth/callback`,
  })

  if (error) return { error: error.message }

  if (data?.user) {
    await adminClient.from('profiles')
      .update({ full_name: fullName })
      .eq('id', data.user.id)
  }

  await logAudit({
    actor_id: ctx.user.id,
    actor_email: ctx.profile.email,
    action: 'student_invited',
    target_type: 'user',
    target_id: email,
  })

  revalidatePath('/admin/students')
  return {}
}

export async function updateStudentGroup(studentId: string, groupId: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('profiles')
    .update({ group_id: groupId || null })
    .eq('id', studentId)
  if (error) return { error: error.message }
  revalidatePath('/admin/students')
  return {}
}

// ── User management ─────────────────────────────────────────

const VALID_ROLES = ['admin', 'group_leader', 'student', 'applicant']

async function guard(): Promise<{ ctx?: Awaited<ReturnType<typeof requireAdmin>>; error?: string }> {
  try {
    return { ctx: await requireAdmin() }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Not authorized' }
  }
}

export async function updateUserProfile(
  userId: string,
  fullName: string,
  email: string
): Promise<{ error?: string }> {
  const { ctx, error: authError } = await guard()
  if (!ctx) return { error: authError }

  const adminClient = getAdminClient()

  const { data: existing } = await adminClient
    .from('profiles').select('email, full_name').eq('id', userId).single()
  if (!existing) return { error: 'User not found' }

  if (email !== existing.email) {
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    })
    if (error) return { error: error.message }
  }

  const { error } = await adminClient
    .from('profiles')
    .update({ full_name: fullName, email })
    .eq('id', userId)
  if (error) return { error: error.message }

  await logAudit({
    actor_id: ctx.user.id,
    actor_email: ctx.profile.email,
    action: 'profile_update',
    target_type: 'user',
    target_id: userId,
    detail: { from: existing, to: { full_name: fullName, email } },
  })

  revalidatePath(`/admin/students/${userId}`)
  revalidatePath('/admin/students')
  return {}
}

export async function updateUserRole(userId: string, role: string): Promise<{ error?: string }> {
  const { ctx, error: authError } = await guard()
  if (!ctx) return { error: authError }
  if (!VALID_ROLES.includes(role)) return { error: 'Invalid role' }
  if (userId === ctx.user.id && role !== 'admin') {
    return { error: "You can't remove your own admin role." }
  }

  const adminClient = getAdminClient()
  const { error } = await adminClient.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }

  await logAudit({
    actor_id: ctx.user.id,
    actor_email: ctx.profile.email,
    action: 'role_change',
    target_type: 'user',
    target_id: userId,
    detail: { role },
  })

  revalidatePath(`/admin/students/${userId}`)
  revalidatePath('/admin/students')
  return {}
}

export async function setUserActive(userId: string, active: boolean): Promise<{ error?: string }> {
  const { ctx, error: authError } = await guard()
  if (!ctx) return { error: authError }
  if (userId === ctx.user.id && !active) {
    return { error: "You can't deactivate your own account." }
  }

  const adminClient = getAdminClient()
  // Banning blocks sign-in and token refresh; '87600h' ≈ 10 years
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : '87600h',
  })
  if (error) return { error: error.message }

  await logAudit({
    actor_id: ctx.user.id,
    actor_email: ctx.profile.email,
    action: active ? 'user_reactivated' : 'user_deactivated',
    target_type: 'user',
    target_id: userId,
  })

  revalidatePath(`/admin/students/${userId}`)
  return {}
}

export async function sendPasswordSetupEmail(userId: string): Promise<{ error?: string }> {
  const { ctx, error: authError } = await guard()
  if (!ctx) return { error: authError }

  const adminClient = getAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('email').eq('id', userId).single()
  if (!profile?.email) return { error: 'User not found' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'}/auth/callback?next=/reset-password`,
  })
  if (error) return { error: error.message }

  await logAudit({
    actor_id: ctx.user.id,
    actor_email: ctx.profile.email,
    action: 'password_setup_email_sent',
    target_type: 'user',
    target_id: userId,
  })

  return {}
}

export async function addGroup(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const name = formData.get('name') as string
  const schoolYearId = formData.get('schoolYearId') as string

  const { error } = await supabase.from('groups').insert({ name, school_year_id: schoolYearId })
  if (error) return { error: error.message }
  revalidatePath('/admin/students')
  return {}
}
