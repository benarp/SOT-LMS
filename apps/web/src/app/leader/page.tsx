import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LeaderOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('group_id')
    .eq('id', user.id)
    .single()

  if (!profile?.group_id) {
    return (
      <div>
        <h1 className="text-2xl font-medium text-gray-900">Group overview</h1>
        <p className="mt-4 text-sm text-gray-400">You haven't been assigned to a group yet. Contact your admin.</p>
      </div>
    )
  }

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
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
    .select('id, week_number, title, due_date')
    .eq('school_year_id', schoolYear?.id || '')
    .lt('due_date', new Date().toISOString())
    .order('week_number', { ascending: false })

  const studentIds = (students || []).map(s => s.id)
  const weekIds = (weeks || []).map(w => w.id)

  const { data: allItems } = await supabase
    .from('homework_items')
    .select('id, week_id')
    .in('week_id', weekIds.length > 0 ? weekIds : ['none'])

  const { data: allSubmissions } = await supabase
    .from('submissions')
    .select('student_id, homework_item_id, is_late')
    .in('student_id', studentIds.length > 0 ? studentIds : ['none'])

  const submissionSet = new Set((allSubmissions || []).map(s => `${s.student_id}:${s.homework_item_id}`))

  // Per-week stats for this group
  const weekStats = (weeks || []).map(week => {
    const weekItems = (allItems || []).filter(i => i.week_id === week.id)
    const totalPossible = weekItems.length * (students || []).length
    const submitted = (allSubmissions || []).filter(s => weekItems.some(i => i.id === s.homework_item_id)).length
    const completionRate = totalPossible > 0 ? Math.round((submitted / totalPossible) * 100) : 0
    return { ...week, completionRate }
  })

  // Students with overdue work
  const overdueStudents = (students || []).filter(student => {
    return (weeks || []).some(week => {
      const weekItems = (allItems || []).filter(i => i.week_id === week.id)
      return weekItems.some(i => !submissionSet.has(`${student.id}:${i.id}`))
    })
  })

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Group overview</h1>
        <p className="text-sm text-gray-400 mt-1">{schoolYear?.name}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Students</p>
          <p className="text-2xl font-medium text-gray-900">{(students || []).length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">With overdue work</p>
          <p className="text-2xl font-medium text-gray-900">{overdueStudents.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Avg completion</p>
          <p className="text-2xl font-medium text-gray-900">
            {weekStats.length > 0 ? Math.round(weekStats.reduce((s, w) => s + w.completionRate, 0) / weekStats.length) : 0}%
          </p>
        </div>
      </div>

      {/* Weekly completion */}
      {weekStats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Weekly completion</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[380px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Week</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Due</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Group completion</th>
                </tr>
              </thead>
              <tbody>
                {weekStats.map((week, i) => (
                  <tr key={week.id} className={i < weekStats.length - 1 ? 'border-b border-gray-50' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900">{week.title}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(week.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${week.completionRate >= 80 ? 'text-green-600' : week.completionRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {week.completionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick student list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-700">Students</h2>
          <Link href="/leader/students" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">View all →</Link>
        </div>
        <div className="space-y-2">
          {(students || []).map(student => {
            const isOverdue = overdueStudents.some(s => s.id === student.id)
            return (
              <Link key={student.id} href={`/leader/students/${student.id}`} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 transition-colors">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                  {(student.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{student.full_name || '—'}</p>
                </div>
                {isOverdue && <span className="text-xs text-red-500 font-medium">Overdue</span>}
              </Link>
            )
          })}
          {(students || []).length === 0 && <p className="text-sm text-gray-400 py-2">No students in this group.</p>}
        </div>
      </div>
    </div>
  )
}
