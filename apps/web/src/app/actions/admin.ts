'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Curriculum ──────────────────────────────────────────────

export async function addWeek(formData: FormData) {
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

  if (error) throw new Error(error.message)
  revalidatePath('/admin/curriculum')
}

export async function addHomeworkItem(formData: FormData) {
  const supabase = await createClient()
  const weekId = formData.get('weekId') as string
  const type = formData.get('type') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const externalUrl = formData.get('externalUrl') as string
  const content = formData.get('content') as string
  const bookId = formData.get('bookId') as string
  const sortOrder = parseInt(formData.get('sortOrder') as string)

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

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/curriculum/${weekId}`)
}

export async function updateHomeworkItem(formData: FormData) {
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

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/curriculum/${weekId}`)
}

export async function deleteHomeworkItem(itemId: string, weekId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('homework_items').delete().eq('id', itemId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/curriculum/${weekId}`)
}

// ── Announcements ───────────────────────────────────────────

export async function createAnnouncement(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const title = formData.get('title') as string
  const body = formData.get('body') as string

  const { error } = await supabase.from('announcements').insert({
    created_by: user.id,
    title,
    body,
    publish_at: new Date().toISOString(),
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/announcements')
}

export async function deleteAnnouncement(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/announcements')
}

// ── Students ────────────────────────────────────────────────

export async function inviteStudent(formData: FormData) {
  const adminClient = getAdminClient()
  const email = formData.get('email') as string
  const fullName = formData.get('fullName') as string

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'}/auth/callback`,
  })

  if (error) throw new Error(error.message)

  if (data?.user) {
    await adminClient.from('profiles')
      .update({ full_name: fullName })
      .eq('id', data.user.id)
  }

  revalidatePath('/admin/students')
}

export async function updateStudentGroup(studentId: string, groupId: string | null) {
  const supabase = await createClient()
  const { error } = await supabase.from('profiles')
    .update({ group_id: groupId || null })
    .eq('id', studentId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/students')
}

export async function addGroup(formData: FormData) {
  const supabase = await createClient()
  const name = formData.get('name') as string
  const schoolYearId = formData.get('schoolYearId') as string

  const { error } = await supabase.from('groups').insert({ name, school_year_id: schoolYearId })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/students')
}
