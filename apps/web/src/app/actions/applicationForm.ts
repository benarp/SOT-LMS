'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { getApplicationCycle } from '@/lib/applicationYear'
import { type AppField, type AnswerMap, missingRequired } from '@/lib/applicationForm'
import { revalidatePath } from 'next/cache'

async function guard(): Promise<{ ok: boolean; error?: string }> {
  try { await requireAdmin(); return { ok: true } }
  catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Not authorized' } }
}

function parseOptions(raw: string | null): string[] | null {
  const lines = (raw ?? '').split('\n').map(l => l.trim()).filter(Boolean)
  return lines.length > 0 ? lines : null
}

const revalidateBuilder = () => {
  revalidatePath('/admin/applications/settings')
  revalidatePath('/apply/questionnaire')
}

// ── Admin: builder CRUD ─────────────────────────────────────

export async function addApplicationField(formData: FormData): Promise<{ error?: string }> {
  const auth = await guard()
  if (!auth.ok) return { error: auth.error }
  const supabase = await createClient()

  const schoolYearId = formData.get('schoolYearId') as string
  const type = formData.get('type') as string
  const label = ((formData.get('label') as string) || '').trim()
  if (!label) return { error: 'Label is required.' }

  const { data: maxRow } = await supabase
    .from('application_fields')
    .select('sort_order')
    .eq('school_year_id', schoolYearId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('application_fields').insert({
    school_year_id: schoolYearId,
    type,
    label,
    help_text: ((formData.get('helpText') as string) || '').trim() || null,
    options: parseOptions(formData.get('options') as string),
    required: formData.get('required') === 'on',
    sort_order: (maxRow?.sort_order ?? 0) + 1,
    show_if_field_id: (formData.get('showIfFieldId') as string) || null,
    show_if_value: ((formData.get('showIfValue') as string) || '').trim() || null,
  })

  if (error) return { error: error.message }
  revalidateBuilder()
  return {}
}

export async function updateApplicationField(formData: FormData): Promise<{ error?: string }> {
  const auth = await guard()
  if (!auth.ok) return { error: auth.error }
  const supabase = await createClient()

  const id = formData.get('fieldId') as string
  const label = ((formData.get('label') as string) || '').trim()
  if (!label) return { error: 'Label is required.' }

  const { error } = await supabase.from('application_fields').update({
    label,
    help_text: ((formData.get('helpText') as string) || '').trim() || null,
    options: parseOptions(formData.get('options') as string),
    required: formData.get('required') === 'on',
    show_if_field_id: (formData.get('showIfFieldId') as string) || null,
    show_if_value: ((formData.get('showIfValue') as string) || '').trim() || null,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidateBuilder()
  return {}
}

export async function deleteApplicationField(fieldId: string): Promise<{ error?: string }> {
  const auth = await guard()
  if (!auth.ok) return { error: auth.error }
  const supabase = await createClient()

  // Answers cascade with the field — block once applicants have answered
  const { count } = await supabase
    .from('application_answers')
    .select('id', { count: 'exact', head: true })
    .eq('field_id', fieldId)
  if (count && count > 0) {
    return { error: `${count} applicant${count === 1 ? ' has' : 's have'} answered this question. Deleting it would erase their answers — edit it instead.` }
  }

  // Clear branching rules that point at the deleted field
  await supabase.from('application_fields')
    .update({ show_if_field_id: null, show_if_value: null })
    .eq('show_if_field_id', fieldId)

  const { error } = await supabase.from('application_fields').delete().eq('id', fieldId)
  if (error) return { error: error.message }
  revalidateBuilder()
  return {}
}

export async function reorderApplicationFields(schoolYearId: string, orderedIds: string[]): Promise<{ error?: string }> {
  const auth = await guard()
  if (!auth.ok) return { error: auth.error }
  const supabase = await createClient()

  // Only reorder within the given year — ignore ids that don't belong to it
  const { data: existing } = await supabase
    .from('application_fields')
    .select('id')
    .eq('school_year_id', schoolYearId)
  const valid = new Set((existing ?? []).map(f => f.id))

  for (let i = 0; i < orderedIds.length; i++) {
    if (!valid.has(orderedIds[i])) continue
    const { error } = await supabase
      .from('application_fields')
      .update({ sort_order: i + 1 })
      .eq('id', orderedIds[i])
    if (error) return { error: error.message }
  }

  revalidateBuilder()
  return {}
}

// ── Applicant: answers ──────────────────────────────────────

async function getOwnApplication() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }

  const { year } = await getApplicationCycle()
  if (!year) return { error: 'No application cycle configured' as const }

  const { data: app } = await supabase
    .from('applications')
    .select('id')
    .eq('school_year_id', year.id)
    .eq('applicant_id', user.id)
    .single()
  if (!app) return { error: 'Application not found' as const }
  return { supabase, applicationId: app.id, schoolYearId: year.id }
}

export async function saveAnswer(fieldId: string, value: string | string[]): Promise<{ error?: string }> {
  const ctx = await getOwnApplication()
  if ('error' in ctx) return { error: ctx.error }

  // Snapshot the field so later form edits don't rewrite this application
  const { data: field } = await ctx.supabase
    .from('application_fields')
    .select('label, type, sort_order')
    .eq('id', fieldId)
    .single()
  if (!field) return { error: 'Question not found' }

  const { error } = await ctx.supabase.from('application_answers').upsert({
    application_id: ctx.applicationId,
    field_id: fieldId,
    field_label: field.label,
    field_type: field.type,
    field_sort: field.sort_order,
    value,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'application_id,field_id' })

  if (error) return { error: error.message }
  return {}
}

export async function saveContactInfo(formData: FormData): Promise<{ error?: string }> {
  const ctx = await getOwnApplication()
  if ('error' in ctx) return { error: ctx.error }

  const { error } = await ctx.supabase.from('applications').update({
    full_name: ((formData.get('full_name') as string) || '').trim(),
    phone: ((formData.get('phone') as string) || '').trim(),
    city: ((formData.get('city') as string) || '').trim(),
    updated_at: new Date().toISOString(),
  }).eq('id', ctx.applicationId)

  if (error) return { error: error.message }
  return {}
}

export async function submitQuestionnaire(): Promise<{ error?: string }> {
  const ctx = await getOwnApplication()
  if ('error' in ctx) return { error: ctx.error }

  // Server-side validation: every visible required question must be answered
  const admin = createAdminClient()
  const [{ data: fields }, { data: answerRows }, { data: app }] = await Promise.all([
    admin.from('application_fields').select('*').eq('school_year_id', ctx.schoolYearId).order('sort_order'),
    admin.from('application_answers').select('field_id, value').eq('application_id', ctx.applicationId),
    admin.from('applications').select('full_name, phone, city').eq('id', ctx.applicationId).single(),
  ])

  if (!app?.full_name?.trim() || !app?.phone?.trim() || !app?.city?.trim()) {
    return { error: 'Please fill in your name, phone, and city.' }
  }

  const answers: AnswerMap = {}
  for (const row of answerRows ?? []) answers[row.field_id] = row.value as string | string[]

  const missing = missingRequired((fields ?? []) as AppField[], answers)
  if (missing.length > 0) {
    return { error: `Please answer: ${missing.map(f => f.label).slice(0, 3).join(' · ')}${missing.length > 3 ? '…' : ''}` }
  }

  const { error } = await ctx.supabase.from('applications').update({
    questionnaire_submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', ctx.applicationId)

  if (error) return { error: error.message }
  revalidatePath('/apply')
  return {}
}
