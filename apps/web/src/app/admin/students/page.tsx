import { createClient } from '@/lib/supabase/server'
import InviteStudentForm from '@/components/admin/InviteStudentForm'
import GroupAssignSelect from '@/components/admin/GroupAssignSelect'
import AddGroupForm from '@/components/admin/AddGroupForm'
import ImpersonateButton from '@/components/admin/ImpersonateButton'

export default async function StudentsPage() {
  const supabase = await createClient()

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id')
    .eq('is_active', true)
    .single()

  const [{ data: students }, { data: groups }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, group_id').eq('role', 'student').order('full_name'),
    supabase.from('groups').select('id, name').eq('school_year_id', schoolYear?.id || '').order('name'),
  ])

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Students</h1>
        <p className="text-sm text-gray-400 mt-1">{(students || []).length} enrolled</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Student roster</h2>
          <div className="space-y-2 mb-4">
            {(students || []).map(student => (
              <div key={student.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{student.full_name || '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{student.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ImpersonateButton email={student.email} name={student.full_name || student.email} />
                    <GroupAssignSelect
                      studentId={student.id}
                      currentGroupId={student.group_id}
                      groups={groups || []}
                    />
                  </div>
                </div>
              </div>
            ))}
            {(students || []).length === 0 && (
              <p className="text-sm text-gray-400 py-2">No students yet.</p>
            )}
          </div>
          <InviteStudentForm />
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Discipleship groups</h2>
          <div className="space-y-2 mb-4">
            {(groups || []).map(group => {
              const memberCount = (students || []).filter(s => s.group_id === group.id).length
              return (
                <div key={group.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{group.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{memberCount} student{memberCount !== 1 ? 's' : ''}</p>
                </div>
              )
            })}
            {(groups || []).length === 0 && (
              <p className="text-sm text-gray-400 py-2">No groups yet.</p>
            )}
          </div>
          {schoolYear && <AddGroupForm schoolYearId={schoolYear.id} />}
        </div>
      </div>
    </div>
  )
}
