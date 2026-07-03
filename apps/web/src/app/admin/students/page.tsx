import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import InviteStudentForm from '@/components/admin/InviteStudentForm'
import AddGroupForm from '@/components/admin/AddGroupForm'
import GroupAssignSelect from '@/components/admin/GroupAssignSelect'
import UsersTable, { type UserRow } from './UsersTable'
import { BILLING_STATUS_LABELS } from '@/lib/billing'

function splitName(full: string | null): { firstName: string; lastName: string } {
  if (!full) return { firstName: '', lastName: '' }
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export default async function UsersPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id')
    .eq('is_active', true)
    .single()

  // Fetch all profiles (all roles), applications for phone/city, groups, and homework data in parallel
  const [
    { data: profiles },
    { data: applications },
    { data: groups },
    { data: allYears },
    currentWeekResult,
  ] = await Promise.all([
    admin.from('profiles').select('id, full_name, email, role, group_id, alumni_year_id').order('full_name'),
    admin.from('applications').select('applicant_id, phone, city'),
    supabase.from('groups').select('id, name').eq('school_year_id', schoolYear?.id ?? '').order('name'),
    admin.from('school_years').select('id, name'),
    // Get the current/most-recent week
    schoolYear
      ? supabase
          .from('weeks')
          .select('id, due_date')
          .eq('school_year_id', schoolYear.id)
          .order('due_date', { ascending: false })
          .limit(1)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const currentWeek = currentWeekResult.data as { id: string; due_date: string } | null

  // Billing status per student for the active year
  const { data: billingAccounts } = schoolYear
    ? await admin
        .from('billing_accounts')
        .select('student_id, status')
        .eq('school_year_id', schoolYear.id)
    : { data: [] }
  const billingStatusByStudent = new Map(
    (billingAccounts ?? []).map(b => [b.student_id, BILLING_STATUS_LABELS[b.status] ?? b.status])
  )

  // Build phone/city lookup keyed by profile id
  const contactByProfile: Record<string, { phone: string | null; city: string | null }> = {}
  for (const app of applications ?? []) {
    contactByProfile[app.applicant_id] = { phone: app.phone ?? null, city: app.city ?? null }
  }

  // Compute homework status for students
  let homeworkStatusMap: Record<string, 'current' | 'late'> = {}
  if (currentWeek) {
    const isPastDue = new Date(currentWeek.due_date) < new Date()
    const { data: items } = await supabase
      .from('homework_items')
      .select('id')
      .eq('week_id', currentWeek.id)

    const itemIds = (items ?? []).map(i => i.id)
    const totalItems = itemIds.length

    if (totalItems > 0) {
      const { data: submissions } = await supabase
        .from('submissions')
        .select('student_id')
        .in('homework_item_id', itemIds)

      const submissionsByStudent: Record<string, number> = {}
      for (const sub of submissions ?? []) {
        submissionsByStudent[sub.student_id] = (submissionsByStudent[sub.student_id] ?? 0) + 1
      }

      for (const profile of profiles ?? []) {
        if (profile.role !== 'student') continue
        const completed = submissionsByStudent[profile.id] ?? 0
        if (completed >= totalItems) {
          homeworkStatusMap[profile.id] = 'current'
        } else if (isPastDue) {
          homeworkStatusMap[profile.id] = 'late'
        }
      }
    }
  }

  const yearNameById = new Map((allYears ?? []).map(y => [y.id, y.name]))

  const users: UserRow[] = (profiles ?? []).map(p => {
    const { firstName, lastName } = splitName(p.full_name)
    const contact = contactByProfile[p.id] ?? { phone: null, city: null }
    return {
      id: p.id,
      email: p.email ?? '',
      firstName,
      lastName,
      phone: contact.phone,
      city: contact.city,
      role: p.role,
      alumniYear: p.alumni_year_id ? yearNameById.get(p.alumni_year_id) ?? null : null,
      paymentStatus: p.role === 'student' ? (billingStatusByStudent.get(p.id) ?? 'Not started') : null,
      homeworkStatus: homeworkStatusMap[p.id] ?? null,
    }
  })

  const students = (profiles ?? []).filter(p => p.role === 'student')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Users</h1>
        <p className="text-sm text-gray-400 mt-1">
          {users.length} total · {students.length} student{students.length !== 1 ? 's' : ''}
        </p>
      </div>

      <UsersTable users={users} />

      {/* Groups section */}
      <div className="mt-12 border-t border-gray-100 pt-8">
        <div className="max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Discipleship groups</h2>
            <div className="space-y-2 mb-4">
              {(groups ?? []).map(group => {
                const count = students.filter(s => s.group_id === group.id).length
                return (
                  <div key={group.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{group.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{count} student{count !== 1 ? 's' : ''}</p>
                  </div>
                )
              })}
              {(groups ?? []).length === 0 && (
                <p className="text-sm text-gray-400 py-2">No groups yet.</p>
              )}
            </div>
            {schoolYear && <AddGroupForm schoolYearId={schoolYear.id} />}
          </div>

          <div>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Invite student</h2>
            <InviteStudentForm />

            <div className="mt-6">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Assign groups</h2>
              <div className="space-y-2">
                {students.map(student => (
                  <div key={student.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                    <p className="text-sm text-gray-900 truncate">{student.full_name || student.email}</p>
                    <GroupAssignSelect
                      studentId={student.id}
                      currentGroupId={student.group_id}
                      groups={groups ?? []}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
