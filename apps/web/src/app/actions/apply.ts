'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getApplicationCycle } from '@/lib/applicationYear'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'
const ADMIN_EMAIL = 'barp@allpeopleschurch.org'
// TODO: swap FROM_EMAIL back to ADMIN_EMAIL after allpeopleschurch.org domain is verified in Resend
const FROM_EMAIL = 'onboarding@resend.dev'

// ─── Applicant: initialize account after signup ───────────────────────────────

export async function initApplicant(fullName: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Update profile: set name + applicant role
  await admin.from('profiles').update({ full_name: fullName, role: 'applicant' }).eq('id', user.id)

  // Applications belong to the open application cycle, not the active year
  const cycle = await getApplicationCycle()
  if (!cycle.year) return { error: 'No application cycle found. Contact an admin.' }
  if (!cycle.isOpen) return { error: 'Applications are currently closed.' }
  const schoolYear = cycle.year

  // Create application if it doesn't exist
  await admin.from('applications').upsert(
    { school_year_id: schoolYear.id, applicant_id: user.id, full_name: fullName },
    { onConflict: 'school_year_id,applicant_id', ignoreDuplicates: true }
  )

  return {}
}

// ─── Applicant: determine which step to show ─────────────────────────────────

export async function getApplicationStep(): Promise<{
  step: 'questionnaire' | 'reference' | 'status'
  applicationId?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { step: 'questionnaire' }

  const { year: schoolYear } = await getApplicationCycle()
  if (!schoolYear) return { step: 'questionnaire' }

  const { data: app } = await supabase
    .from('applications')
    .select('id, status, q_testimony, q_why_attend, q_goals, q_serving, agreement_accepted')
    .eq('school_year_id', schoolYear.id)
    .eq('applicant_id', user.id)
    .single()

  if (!app) return { step: 'questionnaire' }

  // Step 1 complete = at least 3 essay answers filled + agreement accepted
  const answeredEssays = [app.q_testimony, app.q_why_attend, app.q_goals, app.q_serving]
    .filter(Boolean).length
  const step1Done = answeredEssays >= 3 && app.agreement_accepted

  if (!step1Done) return { step: 'questionnaire', applicationId: app.id }

  // Submitted or later = go to status
  if (app.status === 'submitted' || app.status === 'approved' || app.status === 'denied') {
    return { step: 'status', applicationId: app.id }
  }

  return { step: 'reference', applicationId: app.id }
}

// ─── Admin: update application question settings ─────────────────────────────

export async function updateApplicationSettings(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Not authorized' }

  const { year: schoolYear } = await getApplicationCycle()
  if (!schoolYear) return { error: 'No application cycle configured' }

  const updates = {
    school_year_id: schoolYear.id,
    q_testimony_label: formData.get('q_testimony_label') as string,
    q_testimony_hint: formData.get('q_testimony_hint') as string,
    q_why_attend_label: formData.get('q_why_attend_label') as string,
    q_why_attend_hint: formData.get('q_why_attend_hint') as string,
    q_goals_label: formData.get('q_goals_label') as string,
    q_goals_hint: formData.get('q_goals_hint') as string,
    q_serving_label: formData.get('q_serving_label') as string,
    q_serving_hint: formData.get('q_serving_hint') as string,
    q_additional_label: formData.get('q_additional_label') as string,
    q_additional_hint: formData.get('q_additional_hint') as string,
    agreement_text: formData.get('agreement_text') as string,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('application_settings')
    .upsert(updates, { onConflict: 'school_year_id' })

  if (error) return { error: error.message }

  revalidatePath('/admin/applications/settings')
  revalidatePath('/apply/questionnaire')
  return {}
}

// ─── Step 1: Save questionnaire ───────────────────────────────────────────────

export async function saveQuestionnaire(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { year: schoolYear } = await getApplicationCycle()
  if (!schoolYear) return { error: 'No application cycle configured' }

  const updates = {
    full_name: formData.get('full_name') as string,
    phone: formData.get('phone') as string,
    city: formData.get('city') as string,
    q_testimony: formData.get('q_testimony') as string,
    q_why_attend: formData.get('q_why_attend') as string,
    q_goals: formData.get('q_goals') as string,
    q_serving: formData.get('q_serving') as string,
    q_additional: formData.get('q_additional') as string,
    agreement_accepted: formData.get('agreement') === 'on',
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('applications')
    .update(updates)
    .eq('school_year_id', schoolYear.id)
    .eq('applicant_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/apply/questionnaire')
  return {}
}

// ─── Step 2: Save pastor info & send reference email ─────────────────────────

export async function savePastorInfo(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { year: schoolYear } = await getApplicationCycle()
  if (!schoolYear) return { error: 'No application cycle configured' }

  const { data: app } = await supabase
    .from('applications')
    .select('id, full_name')
    .eq('school_year_id', schoolYear.id)
    .eq('applicant_id', user.id)
    .single()

  if (!app) return { error: 'Application not found' }

  const pastorName = formData.get('pastor_name') as string
  const pastorEmail = formData.get('pastor_email') as string
  const pastorChurch = formData.get('pastor_church') as string

  // Create or replace pastoral reference
  const { data: ref, error: refError } = await admin
    .from('pastoral_references')
    .upsert(
      { application_id: app.id, pastor_name: pastorName, pastor_email: pastorEmail, pastor_church: pastorChurch, status: 'sent', sent_at: new Date().toISOString() },
      { onConflict: 'application_id' }
    )
    .select('token')
    .single()

  if (refError) return { error: refError.message }

  // Update application status to submitted
  await admin
    .from('applications')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', app.id)

  // Send emails if Resend is configured
  if (process.env.RESEND_API_KEY && ref) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const referenceUrl = `${SITE_URL}/reference/${ref.token}`

    // Email to pastor
    await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: ADMIN_EMAIL,
      to: pastorEmail,
      subject: `Reference request for ${app.full_name} — School of Transformation`,
      html: buildPastorRequestEmail({ applicantName: app.full_name || 'an applicant', pastorName, referenceUrl }),
    }).catch(() => null)

    // Admin notification
    await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: ADMIN_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New application — ${app.full_name}`,
      html: `<p>${app.full_name} has submitted an application. <a href="${SITE_URL}/admin/applications">Review it here</a>.</p>`,
    }).catch(() => null)
  }

  revalidatePath('/apply/reference')
  revalidatePath('/apply/status')
  return {}
}

// ─── Pastor: submit reference (service role — no auth) ───────────────────────

export async function submitPastoralReference(
  token: string,
  data: { ref_relationship: string; ref_character: string; ref_recommend: string; ref_concerns: string }
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: ref, error: fetchError } = await admin
    .from('pastoral_references')
    .select('id, status, application_id, pastor_name, pastor_email')
    .eq('token', token)
    .single()

  if (fetchError || !ref) return { error: 'Reference not found. Please check your link.' }
  if (ref.status === 'submitted') return { error: 'This reference has already been submitted.' }

  const { error } = await admin
    .from('pastoral_references')
    .update({ ...data, status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', ref.id)

  if (error) return { error: error.message }

  // Send confirmation to pastor
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ref.pastor_email!,
      subject: 'Reference received — School of Transformation',
      html: `<p>Hi ${ref.pastor_name},</p><p>Thank you — we've received your reference. We appreciate you taking the time.</p><p>— School of Transformation</p>`,
    }).catch(() => null)
  }

  return {}
}

// ─── Admin: approve application ───────────────────────────────────────────────

export async function approveApplication(applicationId: string, notes?: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Not authorized' }

  const { data: app } = await admin
    .from('applications')
    .select('applicant_id, full_name, school_year_id')
    .eq('id', applicationId)
    .single()

  if (!app) return { error: 'Application not found' }

  // Update application status
  await admin.from('applications').update({
    status: 'approved',
    decided_at: new Date().toISOString(),
    decision_notes: notes || null,
    updated_at: new Date().toISOString(),
  }).eq('id', applicationId)

  // Enroll immediately only if their year is already running; otherwise they
  // stay an accepted applicant and are enrolled when the year is activated.
  const { data: appYear } = await admin
    .from('school_years').select('is_active').eq('id', app.school_year_id).single()
  if (appYear?.is_active) {
    await admin.from('profiles').update({ role: 'student' }).eq('id', app.applicant_id)
  }

  // Send approval email
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data: applicantProfile } = await admin.from('profiles').select('email').eq('id', app.applicant_id).single()
    if (applicantProfile?.email) {
      await resend.emails.send({
        from: FROM_EMAIL,
        replyTo: ADMIN_EMAIL,
        to: applicantProfile.email,
        subject: 'You\'ve been accepted — School of Transformation',
        html: buildApprovalEmail({ fullName: app.full_name || 'Applicant', notes }),
      }).catch(() => null)
    }
  }

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${applicationId}`)
  return {}
}

// ─── Admin: deny application ──────────────────────────────────────────────────

export async function denyApplication(applicationId: string, notes?: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Not authorized' }

  const { data: app } = await admin
    .from('applications')
    .select('applicant_id, full_name')
    .eq('id', applicationId)
    .single()

  if (!app) return { error: 'Application not found' }

  await admin.from('applications').update({
    status: 'denied',
    decided_at: new Date().toISOString(),
    decision_notes: notes || null,
    updated_at: new Date().toISOString(),
  }).eq('id', applicationId)

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data: applicantProfile } = await admin.from('profiles').select('email').eq('id', app.applicant_id).single()
    if (applicantProfile?.email) {
      await resend.emails.send({
        from: FROM_EMAIL,
        replyTo: ADMIN_EMAIL,
        to: applicantProfile.email,
        subject: 'Your application — School of Transformation',
        html: buildDenialEmail({ fullName: app.full_name || 'Applicant', notes }),
      }).catch(() => null)
    }
  }

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${applicationId}`)
  return {}
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildPastorRequestEmail({ applicantName, pastorName, referenceUrl }: { applicantName: string; pastorName: string; referenceUrl: string }) {
  return `
<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:40px auto;color:#111827;">
  <h2 style="font-size:18px;font-weight:600;">Reference Request — School of Transformation</h2>
  <p>Hi ${pastorName},</p>
  <p>${applicantName} has applied to the School of Transformation discipleship training school and listed you as a pastoral reference.</p>
  <p>We'd love to hear a few words from you. It should only take a few minutes.</p>
  <p style="margin:28px 0;">
    <a href="${referenceUrl}" style="background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:500;">Complete the reference →</a>
  </p>
  <p style="color:#6b7280;font-size:13px;">If you have any questions, reply to this email.</p>
  <p style="color:#6b7280;font-size:13px;">— School of Transformation</p>
</body></html>`
}

function buildApprovalEmail({ fullName, notes }: { fullName: string; notes?: string }) {
  return `
<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:40px auto;color:#111827;">
  <h2 style="font-size:18px;font-weight:600;">You've been accepted!</h2>
  <p>Hi ${fullName},</p>
  <p>We're excited to let you know that your application to the School of Transformation has been <strong>accepted</strong>.</p>
  ${notes ? `<p>${notes}</p>` : ''}
  <p>Your next step is to set up tuition payment — a $400 deposit today, then $200/month for 10 months.</p>
  <p style="margin:28px 0;">
    <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'}/dashboard/billing" style="background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:500;">Set up tuition payment →</a>
  </p>
  <p>We'll be in touch soon with next steps. Welcome to the family!</p>
  <p>— School of Transformation</p>
</body></html>`
}

function buildDenialEmail({ fullName, notes }: { fullName: string; notes?: string }) {
  return `
<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:40px auto;color:#111827;">
  <h2 style="font-size:18px;font-weight:600;">Your Application — School of Transformation</h2>
  <p>Hi ${fullName},</p>
  <p>Thank you for applying to the School of Transformation. After prayerful consideration, we're not able to offer you a spot at this time.</p>
  ${notes ? `<p>${notes}</p>` : ''}
  <p>We encourage you to apply again in a future year. Please don't hesitate to reach out if you have questions.</p>
  <p>— School of Transformation</p>
</body></html>`
}
