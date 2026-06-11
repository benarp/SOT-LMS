'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

export async function setActiveSchoolYear(schoolYearId: string): Promise<{ error?: string }> {
  const { error: authError } = await assertAdmin()
  if (authError) return { error: authError }

  const admin = createAdminClient()

  // Deactivate all, then activate the selected one
  await admin.from('school_years').update({ is_active: false }).neq('id', 'none')
  const { error } = await admin.from('school_years').update({ is_active: true }).eq('id', schoolYearId)

  if (error) return { error: error.message }
  revalidatePath('/admin/settings')
  revalidatePath('/admin')
  revalidatePath('/admin/curriculum')
  return {}
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
