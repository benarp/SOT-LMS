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

  // Enroll everyone accepted for this year. Applicants and returning alumni
  // become students; admins/leaders are never downgraded.
  const { data: approvedApps } = await admin
    .from('applications')
    .select('applicant_id')
    .eq('school_year_id', schoolYearId)
    .eq('status', 'approved')

  let enrolled = 0
  const applicantIds = (approvedApps ?? []).map(a => a.applicant_id)
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

  // Graduate the cohort: every current student becomes an alumnus of this
  // year. Returning students who'll lead groups next year get promoted
  // afterward from their profile page.
  const { data: graduated, error: gradError } = await admin
    .from('profiles')
    .update({ role: 'alumni', alumni_year_id: schoolYearId, group_id: null })
    .eq('role', 'student')
    .select('id')
  if (gradError) return { error: gradError.message }

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
