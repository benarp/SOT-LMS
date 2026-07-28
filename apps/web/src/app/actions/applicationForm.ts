'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { getApplicationCycle } from '@/lib/applicationYear'
import { type AppField, type AnswerMap, type FormKey, stepErrors } from '@/lib/applicationForm'
import { revalidatePath } from 'next/cache'

async function guard(): Promise<{ ok: boolean; error?: string }> {
  try { await requireAdmin(); return { ok: true } }
  catch (err) { return { ok: false, error: err instanceof Error ? err.message : 'Not authorized' } }
}

function parseOptions(raw: string | null): string[] | null {
  const lines = (raw ?? '').split('\n').map(l => l.trim()).filter(Boolean)
  return lines.length > 0 ? lines : null
}

function parseIntOrNull(raw: FormDataEntryValue | null): number | null {
  const trimmed = ((raw as string) ?? '').trim()
  if (!trimmed) return null
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) ? n : null
}

const revalidateBuilder = () => {
  revalidatePath('/admin/applications/settings')
  revalidatePath('/apply/questionnaire')
  revalidatePath('/apply/wellness')
}

// ── Admin: builder CRUD ─────────────────────────────────────

/** 'equals' (default) submits showIfValue; 'one_of' submits repeated showIfValues. */
function parseBranching(formData: FormData): { show_if_value: string | null; show_if_values: string[] | null } {
  const mode = (formData.get('showIfMode') as string) || 'equals'
  if (mode === 'one_of') {
    const values = formData.getAll('showIfValues').map(v => String(v).trim()).filter(Boolean)
    return { show_if_value: null, show_if_values: values.length > 0 ? values : null }
  }
  return { show_if_value: ((formData.get('showIfValue') as string) || '').trim() || null, show_if_values: null }
}

export async function addApplicationField(formData: FormData): Promise<{ error?: string }> {
  const auth = await guard()
  if (!auth.ok) return { error: auth.error }
  const supabase = await createClient()

  const schoolYearId = formData.get('schoolYearId') as string
  const formKey = ((formData.get('formKey') as string) || 'application') as FormKey
  const type = formData.get('type') as string
  const label = ((formData.get('label') as string) || '').trim()
  if (!label) return { error: 'Label is required.' }

  const { data: maxRow } = await supabase
    .from('application_fields')
    .select('sort_order')
    .eq('school_year_id', schoolYearId)
    .eq('form_key', formKey)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const branching = parseBranching(formData)

  const { error } = await supabase.from('application_fields').insert({
    school_year_id: schoolYearId,
    form_key: formKey,
    type,
    label,
    help_text: ((formData.get('helpText') as string) || '').trim() || null,
    options: parseOptions(formData.get('options') as string),
    required: formData.get('required') === 'on',
    sort_order: (maxRow?.sort_order ?? 0) + 1,
    show_if_field_id: (formData.get('showIfFieldId') as string) || null,
    ...branching,
    min_select: parseIntOrNull(formData.get('minSelect')),
    max_select: parseIntOrNull(formData.get('maxSelect')),
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

  const branching = parseBranching(formData)

  const { error } = await supabase.from('application_fields').update({
    label,
    help_text: ((formData.get('helpText') as string) || '').trim() || null,
    options: parseOptions(formData.get('options') as string),
    required: formData.get('required') === 'on',
    show_if_field_id: (formData.get('showIfFieldId') as string) || null,
    ...branching,
    min_select: parseIntOrNull(formData.get('minSelect')),
    max_select: parseIntOrNull(formData.get('maxSelect')),
    // form_key is intentionally not editable here — moving a field between
    // Application/Wellness isn't supported, avoids accidental cross-form moves.
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
    .update({ show_if_field_id: null, show_if_value: null, show_if_values: null })
    .eq('show_if_field_id', fieldId)

  const { error } = await supabase.from('application_fields').delete().eq('id', fieldId)
  if (error) return { error: error.message }
  revalidateBuilder()
  return {}
}

export async function reorderApplicationFields(schoolYearId: string, formKey: FormKey, orderedIds: string[]): Promise<{ error?: string }> {
  const auth = await guard()
  if (!auth.ok) return { error: auth.error }
  const supabase = await createClient()

  // Only reorder within the given year + form — ignore ids that don't belong
  // (drag-reorder only ever happens within one filtered tab view)
  const { data: existing } = await supabase
    .from('application_fields')
    .select('id')
    .eq('school_year_id', schoolYearId)
    .eq('form_key', formKey)
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
    date_of_birth: ((formData.get('date_of_birth') as string) || '').trim() || null,
    gender: ((formData.get('gender') as string) || '').trim() || null,
    address_line1: ((formData.get('address_line1') as string) || '').trim() || null,
    address_line2: ((formData.get('address_line2') as string) || '').trim() || null,
    city: ((formData.get('city') as string) || '').trim(),
    address_region: ((formData.get('address_region') as string) || '').trim() || null,
    address_postal_code: ((formData.get('address_postal_code') as string) || '').trim() || null,
    address_country: ((formData.get('address_country') as string) || '').trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', ctx.applicationId)

  if (error) return { error: error.message }
  return {}
}

const PHOTO_BUCKET = 'applicant-photos'

/**
 * Record an uploaded profile photo. The file itself is uploaded straight to
 * Storage by the browser (RLS limits applicants to their own uid/ folder);
 * this action snapshots it on the application and cleans up any previous photo.
 */
export async function saveProfilePhoto(filePath: string, fileName: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // The client controls filePath — never accept a path outside their folder
  if (!filePath.startsWith(`${user.id}/`)) return { error: 'Invalid file path' }

  const ctx = await getOwnApplication()
  if ('error' in ctx) return { error: ctx.error }

  const { data: existing } = await ctx.supabase
    .from('applications')
    .select('profile_photo_path')
    .eq('id', ctx.applicationId)
    .single()

  const { error } = await ctx.supabase.from('applications').update({
    profile_photo_path: filePath,
    profile_photo_name: fileName,
    updated_at: new Date().toISOString(),
  }).eq('id', ctx.applicationId)
  if (error) return { error: error.message }

  if (existing?.profile_photo_path && existing.profile_photo_path !== filePath) {
    await createAdminClient().storage.from(PHOTO_BUCKET)
      .remove([existing.profile_photo_path]).catch(() => null)
  }

  return {}
}

export async function submitQuestionnaire(honestyAcknowledged: boolean): Promise<{ error?: string }> {
  const ctx = await getOwnApplication()
  if ('error' in ctx) return { error: ctx.error }
  if (!honestyAcknowledged) return { error: 'Please acknowledge the honesty statement before submitting.' }

  // Server-side validation: every visible required question must be answered
  const admin = createAdminClient()
  const [{ data: fields }, { data: answerRows }, { data: app }] = await Promise.all([
    admin.from('application_fields').select('*').eq('school_year_id', ctx.schoolYearId).eq('form_key', 'application').order('sort_order'),
    admin.from('application_answers').select('field_id, value').eq('application_id', ctx.applicationId),
    admin.from('applications').select('full_name, phone, city, date_of_birth, gender, address_line1').eq('id', ctx.applicationId).single(),
  ])

  if (!app?.full_name?.trim() || !app?.phone?.trim() || !app?.city?.trim()) {
    return { error: 'Please fill in your name, phone, and city.' }
  }
  if (!app?.date_of_birth || !app?.gender || !app?.address_line1?.trim()) {
    return { error: 'Please complete your profile (birthdate, gender, and address) before submitting.' }
  }

  const answers: AnswerMap = {}
  for (const row of answerRows ?? []) answers[row.field_id] = row.value as string | string[]

  const error1 = stepErrors((fields ?? []) as AppField[], answers)
  if (error1) return { error: error1 }

  const { error } = await ctx.supabase.from('applications').update({
    questionnaire_submitted_at: new Date().toISOString(),
    honesty_acknowledged_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', ctx.applicationId)

  if (error) return { error: error.message }
  revalidatePath('/apply')
  return {}
}

export async function submitWellnessSurvey(honestyAcknowledged: boolean): Promise<{ error?: string }> {
  const ctx = await getOwnApplication()
  if ('error' in ctx) return { error: ctx.error }
  if (!honestyAcknowledged) return { error: 'Please acknowledge the honesty statement before submitting.' }

  const admin = createAdminClient()
  const [{ data: fields }, { data: answerRows }, { data: app }] = await Promise.all([
    admin.from('application_fields').select('*').eq('school_year_id', ctx.schoolYearId).eq('form_key', 'wellness').order('sort_order'),
    admin.from('application_answers').select('field_id, value').eq('application_id', ctx.applicationId),
    admin.from('applications').select('status').eq('id', ctx.applicationId).single(),
  ])

  if (app?.status !== 'interview') {
    return { error: 'The health & wellness survey is not open yet.' }
  }

  const wellnessFieldIds = new Set((fields ?? []).map(f => f.id))
  const answers: AnswerMap = {}
  for (const row of answerRows ?? []) {
    if (wellnessFieldIds.has(row.field_id)) answers[row.field_id] = row.value as string | string[]
  }

  const error1 = stepErrors((fields ?? []) as AppField[], answers)
  if (error1) return { error: error1 }

  const { error } = await ctx.supabase.from('applications').update({
    wellness_submitted_at: new Date().toISOString(),
    wellness_honesty_acknowledged_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', ctx.applicationId)

  if (error) return { error: error.message }
  revalidatePath('/apply')
  return {}
}
