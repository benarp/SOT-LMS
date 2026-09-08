'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as string }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Not authorized' as string }
  return { error: null }
}

export async function createSchoolYear(formData: FormData): Promise<{ error?: string }> {
  const { error: authError } = await assertAdmin()
  if (authError) return { error: authError }

  const admin = createAdminClient()
  const name = formData.get('name') as string
  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string

  const { error } = await admin.from('school_years').insert({
    name,
    start_date: startDate || null,
    end_date: endDate || null,
    is_active: false,
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/settings')
  return {}
}

export async function setActiveSchoolYear(schoolYearId: string): Promise<{ error?: string; enrolled?: number }> {
  const { error: authError } = await assertAdmin()
  if (authError) return { error: authError }

  const admin = createAdminClient()

  // Deactivate all, then activate the selected one
  await admin.from('school_years').update({ is_active: false }).neq('id', 'none')
  const { error } = await admin.from('school_years').update({ is_active: true }).eq('id', schoolYearId)
  if (error) return { error: error.message }

  // Enroll everyone accepted for this year WHO HAS PAID THEIR DEPOSIT.
  // Applicants and returning alumni become students; admins/leaders are never
  // downgraded. Accepted-but-unpaid applicants stay gated on the status page
  // (promote manually from their profile if payment was handled offline).
  const [{ data: approvedApps }, { data: paidAccounts }] = await Promise.all([
    admin.from('applications').select('applicant_id').eq('school_year_id', schoolYearId).eq('status', 'approved'),
    admin.from('billing_accounts').select('student_id').eq('school_year_id', schoolYearId).eq('deposit_paid', true),
  ])

  let enrolled = 0
  const paidIds = new Set((paidAccounts ?? []).map(b => b.student_id))
  const applicantIds = (approvedApps ?? []).map(a => a.applicant_id).filter(id => paidIds.has(id))
  if (applicantIds.length > 0) {
    const { data: promoted } = await admin
      .from('profiles')
      .update({ role: 'student' })
      .in('id', applicantIds)
      .in('role', ['applicant', 'alumni'])
      .select('id')
    enrolled = promoted?.length ?? 0
  }

  revalidatePath('/admin/settings')
  revalidatePath('/admin')
  revalidatePath('/admin/curriculum')
  revalidatePath('/admin/students')
  return { enrolled }
}

/**
 * Students actually associated with a school year.
 *
 * `profiles` has no direct school_year column, so membership is inferred from
 * the year-scoped records a student accumulates: their group, billing account,
 * application, or any submitted homework. Completing a year must only graduate
 * *that* year's cohort — graduating every `role = 'student'` row (the original
 * behaviour) swept up a freshly-imported cohort that hadn't started yet.
 */
async function cohortStudentIds(
  admin: ReturnType<typeof createAdminClient>,
  schoolYearId: string
): Promise<Set<string>> {
  const ids = new Set<string>()

  const [{ data: groups }, { data: billing }, { data: apps }, { data: weeks }] = await Promise.all([
    admin.from('groups').select('id').eq('school_year_id', schoolYearId),
    admin.from('billing_accounts').select('student_id').eq('school_year_id', schoolYearId),
    admin.from('applications').select('applicant_id').eq('school_year_id', schoolYearId),
    admin.from('weeks').select('id').eq('school_year_id', schoolYearId),
  ])

  for (const b of billing ?? []) if (b.student_id) ids.add(b.student_id)
  for (const a of apps ?? []) if (a.applicant_id) ids.add(a.applicant_id)

  const groupIds = (groups ?? []).map(g => g.id)
  if (groupIds.length > 0) {
    const { data: grouped } = await admin.from('profiles').select('id').in('group_id', groupIds)
    for (const p of grouped ?? []) ids.add(p.id)
  }

  // Anyone who submitted homework belonging to this year's weeks
  const weekIds = (weeks ?? []).map(w => w.id)
  if (weekIds.length > 0) {
    const { data: items } = await admin.from('homework_items').select('id').in('week_id', weekIds)
    const itemIds = (items ?? []).map(i => i.id)
    if (itemIds.length > 0) {
      const { data: subs } = await admin.from('submissions').select('student_id').in('homework_item_id', itemIds)
      for (const s of subs ?? []) if (s.student_id) ids.add(s.student_id)
    }
  }

  return ids
}

/**
 * Who "Complete this year" would graduate, so the admin can see the list
 * before committing to it. Read-only.
 */
export async function previewCompleteSchoolYear(
  schoolYearId: string
): Promise<{ error?: string; names?: string[]; total?: number }> {
  const { error: authError } = await assertAdmin()
  if (authError) return { error: authError }

  const admin = createAdminClient()
  const cohort = await cohortStudentIds(admin, schoolYearId)
  if (cohort.size === 0) return { names: [], total: 0 }

  const { data: students } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('role', 'student')
    .in('id', Array.from(cohort))
    .order('full_name')

  return {
    names: (students ?? []).map(s => s.full_name || s.email || 'Unnamed'),
    total: (students ?? []).length,
  }
}

export async function completeSchoolYear(schoolYearId: string): Promise<{ error?: string; graduated?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: caller } = await supabase.from('profiles').select('role, email').eq('id', user.id).single()
  if (caller?.role !== 'admin') return { error: 'Not authorized' }

  const admin = createAdminClient()

  const { data: year, error: yearError } = await admin
    .from('school_years')
    .update({ completed_at: new Date().toISOString(), is_active: false })
    .eq('id', schoolYearId)
    .select('name')
    .single()
  if (yearError) return { error: yearError.message }

  // Graduate only THIS year's cohort. Scoping matters: an unscoped update
  // graduates students who were imported for a future year and have never
  // attended, locking them out of the dashboard.
  const cohort = await cohortStudentIds(admin, schoolYearId)

  let graduated: { id: string }[] = []
  if (cohort.size > 0) {
    const { data, error: gradError } = await admin
      .from('profiles')
      .update({ role: 'alumni', alumni_year_id: schoolYearId, group_id: null })
      .eq('role', 'student')
      .in('id', Array.from(cohort))
      .select('id')
    if (gradError) return { error: gradError.message }
    graduated = data ?? []
  }

  await logAudit({
    actor_id: user.id,
    actor_email: caller.email,
    action: 'school_year_completed',
    target_type: 'school_year',
    target_id: schoolYearId,
    detail: { name: year?.name, graduated: graduated?.length ?? 0 },
  })

  revalidatePath('/admin/settings')
  revalidatePath('/admin/students')
  revalidatePath('/admin')
  return { graduated: graduated?.length ?? 0 }
}

export async function reopenSchoolYear(schoolYearId: string): Promise<{ error?: string; restored?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: caller } = await supabase.from('profiles').select('role, email').eq('id', user.id).single()
  if (caller?.role !== 'admin') return { error: 'Not authorized' }

  const admin = createAdminClient()

  const { data: year, error: yearError } = await admin
    .from('school_years')
    .update({ completed_at: null })
    .eq('id', schoolYearId)
    .select('name')
    .single()
  if (yearError) return { error: yearError.message }

  // Undo the graduation — but only for those still alumni of this year,
  // so anyone already promoted (e.g. to group leader) is left alone.
  const { data: restored, error: restoreError } = await admin
    .from('profiles')
    .update({ role: 'student', alumni_year_id: null })
    .eq('role', 'alumni')
    .eq('alumni_year_id', schoolYearId)
    .select('id')
  if (restoreError) return { error: restoreError.message }

  await logAudit({
    actor_id: user.id,
    actor_email: caller.email,
    action: 'school_year_reopened',
    target_type: 'school_year',
    target_id: schoolYearId,
    detail: { name: year?.name, restored: restored?.length ?? 0 },
  })

  revalidatePath('/admin/settings')
  revalidatePath('/admin/students')
  revalidatePath('/admin')
  return { restored: restored?.length ?? 0 }
}

export async function updateApplicationWindow(formData: FormData): Promise<{ error?: string }> {
  const { error: authError } = await assertAdmin()
  if (authError) return { error: authError }

  const supabase = await createClient()
  const schoolYearId = formData.get('school_year_id') as string
  const openAt = formData.get('applications_open_at') as string
  const closeAt = formData.get('applications_close_at') as string

  const { error } = await supabase
    .from('school_years')
    .update({
      applications_open_at: openAt || null,
      applications_close_at: closeAt || null,
    })
    .eq('id', schoolYearId)

  if (error) return { error: error.message }
  revalidatePath('/admin/settings')
  revalidatePath('/apply')
  return {}
}
