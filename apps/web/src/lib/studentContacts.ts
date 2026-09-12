import { createAdminClient } from '@/lib/supabase/admin'
import { formatPhone, smsHref } from '@/lib/phone'

export type StudentContact = {
  groupName: string | null
  phone: string | null
  phoneHref: string | null
}

// `profiles.phone` carries a column-level REVOKE from `authenticated`
// (supabase/migration-profile-contact-fields.sql), which is checked before RLS —
// so it is unreadable through the cookie client even for an admin. Every caller
// must be behind the admin gate.
export async function contactsForStudents(
  students: { id: string; group_id?: string | null }[]
): Promise<Map<string, StudentContact>> {
  const contacts = new Map<string, StudentContact>()
  const ids = students.map(s => s.id)
  if (ids.length === 0) return contacts

  const admin = createAdminClient()
  const [{ data: profiles }, { data: applications }, { data: groups }] = await Promise.all([
    admin.from('profiles').select('id, phone').in('id', ids),
    admin.from('applications').select('applicant_id, phone').in('applicant_id', ids),
    admin.from('groups').select('id, name'),
  ])

  const profilePhones = new Map((profiles || []).map(p => [p.id, p.phone as string | null]))
  // Students imported from the roster never went through the apply flow, and
  // applicants predate the profile field — so each is the other's fallback.
  const applicationPhones = new Map((applications || []).map(a => [a.applicant_id, a.phone as string | null]))
  const groupNames = new Map((groups || []).map(g => [g.id, g.name as string]))

  for (const student of students) {
    const raw = profilePhones.get(student.id) ?? applicationPhones.get(student.id) ?? null
    contacts.set(student.id, {
      groupName: student.group_id ? groupNames.get(student.group_id) ?? null : null,
      phone: formatPhone(raw),
      phoneHref: smsHref(raw),
    })
  }
  return contacts
}
