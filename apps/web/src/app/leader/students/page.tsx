import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LeaderStudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('group_id')
    .eq('id', user.id)
    .single()

  if (!profile?.group_id) redirect('/leader')

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id')
    .eq('is_active', true)
    .single()

  const { data: students } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('group_id', profile.group_id)
    .eq('role', 'student')
    .order('full_name')

  const { data: weeks } = await supabase
    .from('weeks')
    .select('id')
    .eq('school_year_id', schoolYear?.id || '')
    .lt('due_date', new Date().toISOString())

  const weekIds = (weeks || []).map(w => w.id)
  const { data: allItems } = await supabase
    .from('homework_items')
    .select('id, week_id')
    .in('week_id', weekIds.length > 0 ? weekIds : ['none'])

  const studentIds = (students || []).map(s => s.id)
  const { data: allSubmissions } = await supabase
    .from('submissions')
    .select('student_id, homework_item_id, is_late')
    .in('student_id', studentIds.length > 0 ? studentIds : ['none'])

  const studentStats = (students || []).map(student => {
    const completed = (allSubmissions || []).filter(s => s.student_id === student.id).length
    const late = (allSubmissions || []).filter(s => s.student_id === student.id && s.is_late).length
    const overdue = (weeks || []).reduce((count, week) => {
      const weekItems = (allItems || []).filter(i => i.week_id === week.id)
      const done = weekItems.filter(i => (allSubmissions || []).some(s => s.student_id === student.id && s.homework_item_id === i.id)).length
      return count + (done < weekItems.length ? 1 : 0)
    }, 0)
    return { ...student, completed, late, overdue, total: allItems?.length || 0 }
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Students</h1>
        <p className="text-sm text-gray-400 mt-1">{(students || []).length} in your group</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Student</th>
              <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Completed</th>
              <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Late</th>
              <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Overdue weeks</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {studentStats.map((student, i) => (
              <tr key={student.id} className={i < studentStats.length - 1 ? 'border-b border-gray-50' : ''}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{student.full_name || '—'}</p>
                  <p className="text-xs text-gray-400">{student.email}</p>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{student.completed}/{student.total}</td>
                <td className="px-4 py-3 text-right text-gray-400">{student.late}</td>
                <td className="px-4 py-3 text-right">
                  {student.overdue > 0
                    ? <span className="text-red-500 font-medium">{student.overdue}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/leader/students/${student.id}`} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">View →</Link>
                </td>
              </tr>
            ))}
            {studentStats.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">No students in your group.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
