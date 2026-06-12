'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const typeLabels: Record<string, string> = {
  bible_reading: 'Scripture Reading',
  book_reading: 'Book Reading',
  video: 'Video',
  book_reflection: 'Reflection',
  reflection: 'Reflection',
  written: 'Reflection',
}

const typeIcons: Record<string, string> = {
  bible_reading: '📖',
  book_reading: '📚',
  video: '▶️',
  book_reflection: '✍️',
  reflection: '✍️',
  written: '✍️',
}

function buildEmailHtml({
  week,
  items,
  announcements,
  schoolYear,
  unsubscribeUrl,
}: {
  week: { week_number: number; title: string; due_date: string }
  items: { type: string; title: string; description?: string | null; external_url?: string | null }[]
  announcements: { title: string; body: string }[]
  schoolYear: { name: string }
  unsubscribeUrl?: string
}) {
  const dueDate = new Date(week.due_date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const announcementsHtml = announcements.length > 0
    ? `
      <div style="margin-bottom:32px;">
        <h2 style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin:0 0 12px 0;">Announcements</h2>
        ${announcements.map(a => `
          <div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:14px 16px;margin-bottom:10px;border-radius:0 8px 8px 0;">
            <p style="font-weight:600;color:#1e40af;margin:0 0 4px 0;font-size:14px;">${escapeHtml(a.title)}</p>
            <p style="color:#1d4ed8;margin:0;font-size:14px;line-height:1.5;">${escapeHtml(a.body)}</p>
          </div>
        `).join('')}
      </div>
    `
    : ''

  const itemsHtml = items.map(item => `
    <div style="padding:14px 0;border-bottom:1px solid #f3f4f6;display:flex;align-items:flex-start;gap:12px;">
      <span style="font-size:18px;flex-shrink:0;margin-top:1px;">${typeIcons[item.type] || '•'}</span>
      <div>
        <p style="font-size:11px;color:#9ca3af;margin:0 0 2px 0;text-transform:uppercase;letter-spacing:0.06em;">${typeLabels[item.type] || escapeHtml(item.type)}</p>
        <p style="font-size:14px;font-weight:500;color:#111827;margin:0;">${escapeHtml(item.title)}</p>
        ${item.description ? `<p style="font-size:13px;color:#6b7280;margin:3px 0 0 0;">${escapeHtml(item.description)}</p>` : ''}
        ${item.external_url ? `<a href="${escapeHtml(item.external_url)}" style="font-size:13px;color:#3b82f6;margin:4px 0 0 0;display:inline-block;">Watch / read →</a>` : ''}
      </div>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

    <!-- Header -->
    <div style="background:#111827;padding:28px 36px;">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px 0;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(schoolYear.name)}</p>
      <h1 style="color:#ffffff;font-size:20px;font-weight:600;margin:0;">School of Transformation</h1>
    </div>

    <!-- Week label -->
    <div style="background:#f9fafb;border-bottom:1px solid #f3f4f6;padding:16px 36px;">
      <p style="font-size:12px;color:#9ca3af;margin:0 0 2px 0;text-transform:uppercase;letter-spacing:0.08em;">Week ${week.week_number}</p>
      <h2 style="font-size:22px;font-weight:600;color:#111827;margin:0 0 4px 0;">${escapeHtml(week.title)}</h2>
      <p style="font-size:13px;color:#6b7280;margin:0;">Due ${dueDate}</p>
    </div>

    <!-- Body -->
    <div style="padding:28px 36px;">

      ${announcementsHtml}

      <h2 style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin:0 0 4px 0;">This week's homework</h2>
      <div style="border-top:1px solid #f3f4f6;">
        ${itemsHtml || '<p style="color:#9ca3af;font-size:14px;padding:16px 0 0 0;">No homework items added yet.</p>'}
      </div>
    </div>

    <!-- Footer CTA -->
    <div style="padding:28px 36px;text-align:center;border-top:1px solid #f3f4f6;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'}"
         style="display:inline-block;background:#111827;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;">
        Log in to mark items complete →
      </a>
      <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
        School of Transformation · All Peoples Church
      </p>
      ${unsubscribeUrl ? `
      <p style="font-size:11px;color:#9ca3af;margin:8px 0 0 0;">
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe from these emails</a>
      </p>` : ''}
    </div>

  </div>
</body>
</html>
  `.trim()
}

export async function sendWeeklyEmail(): Promise<{ sent: number; weekTitle?: string; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: 0, error: 'RESEND_API_KEY is not configured' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sent: 0, error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { sent: 0, error: 'Not authorized' }

  const { data: schoolYear } = await supabase
    .from('school_years').select('id, name').eq('is_active', true).single()
  if (!schoolYear) return { sent: 0, error: 'No active school year' }

  // Get the next upcoming week
  const { data: week } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('school_year_id', schoolYear.id)
    .gte('due_date', new Date().toISOString())
    .order('due_date', { ascending: true })
    .limit(1)
    .single()

  if (!week) return { sent: 0, error: 'No upcoming week found. Add a future week in Curriculum first.' }

  const [{ data: items }, { data: announcements }, studentsResult] = await Promise.all([
    supabase
      .from('homework_items')
      .select('id, type, title, description, external_url')
      .eq('week_id', week.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('announcements')
      .select('title, body')
      .lte('publish_at', new Date().toISOString())
      .is('target_group_id', null)
      .order('publish_at', { ascending: false })
      .limit(5),
    supabase
      .from('profiles')
      .select('email, full_name, email_opt_out, unsubscribe_token')
      .eq('role', 'student')
      .eq('email_opt_out', false),
  ])

  // Fall back to the pre-migration column set if unsubscribe columns don't exist yet
  let students: { email: string | null; full_name: string | null; unsubscribe_token?: string }[] | null =
    studentsResult.data
  if (studentsResult.error) {
    const fallback = await supabase.from('profiles').select('email, full_name').eq('role', 'student')
    students = fallback.data
  }

  if (!students || students.length === 0) return { sent: 0, error: 'No students found' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'
  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromEmail = 'onboarding@resend.dev' // TODO: swap back to barp@allpeopleschurch.org after domain verification
  const subject = `Week ${week.week_number} — ${week.title} | School of Transformation`

  const emails = students
    .filter(s => s.email)
    .map(s => ({
      from: fromEmail,
      replyTo: 'barp@allpeopleschurch.org',
      to: s.email!,
      subject,
      html: buildEmailHtml({
        week,
        items: items || [],
        announcements: announcements || [],
        schoolYear,
        unsubscribeUrl: s.unsubscribe_token ? `${siteUrl}/unsubscribe/${s.unsubscribe_token}` : undefined,
      }),
    }))

  try {
    // Resend batch allows up to 100 per call
    const chunks: typeof emails[] = []
    for (let i = 0; i < emails.length; i += 100) chunks.push(emails.slice(i, i + 100))

    let sent = 0
    for (const chunk of chunks) {
      const result = await resend.batch.send(chunk)
      if (result.data) sent += result.data.length
    }

    // Best-effort send log — powers the "last sent" indicator
    try {
      await createAdminClient().from('email_log').insert({
        type: 'weekly',
        week_id: week.id,
        sent_by: user.id,
        recipient_count: sent,
      })
    } catch (err) {
      console.error('email_log insert failed:', err)
    }

    return { sent, weekTitle: week.title }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { sent: 0, error: msg }
  }
}

export async function sendTestEmail(): Promise<{ weekTitle?: string; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { error: 'RESEND_API_KEY is not configured' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Not authorized' }

  const { data: schoolYear } = await supabase
    .from('school_years').select('id, name').eq('is_active', true).single()
  if (!schoolYear) return { error: 'No active school year' }

  const { data: week } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('school_year_id', schoolYear.id)
    .gte('due_date', new Date().toISOString())
    .order('due_date', { ascending: true })
    .limit(1)
    .single()

  if (!week) return { error: 'No upcoming week found.' }

  const [{ data: items }, { data: announcements }] = await Promise.all([
    supabase.from('homework_items').select('id, type, title, description, external_url').eq('week_id', week.id).order('sort_order', { ascending: true }),
    supabase.from('announcements').select('title, body').lte('publish_at', new Date().toISOString()).is('target_group_id', null).order('publish_at', { ascending: false }).limit(5),
  ])

  const html = buildEmailHtml({ week, items: items || [], announcements: announcements || [], schoolYear })
  const resend = new Resend(process.env.RESEND_API_KEY)
  const toEmail = profile?.email || 'barp@allpeopleschurch.org'

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev', // TODO: swap back to barp@allpeopleschurch.org after domain verification
      replyTo: 'barp@allpeopleschurch.org',
      to: toEmail,
      subject: `[TEST] Week ${week.week_number} — ${week.title} | School of Transformation`,
      html,
    })
    return { weekTitle: week.title }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg }
  }
}
