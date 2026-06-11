import { createClient } from '@/lib/supabase/server'

export default async function ReportsPage() {
  const supabase = await createClient()

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const [{ data: students }, { data: weeks }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, group_id').eq('role', 'student').order('full_name'),
    supabase.from('weeks').select('id, week_number, title, due_date').eq('school_year_id', schoolYear?.id || '').order('week_number', { ascending: false }),
  ])

  const studentIds = (students || []).map(s => s.id)
  const weekIds = (weeks || []).map(w => w.id)

  const { data: allItems } = await supabase
    .from('homework_items')
    .select('id, week_id')
    .in('week_id', weekIds.length > 0 ? weekIds : ['none'])

  const { data: allSubmissions } = await supabase
    .from('submissions')
    .select('student_id, homework_item_id, completed_at, is_late')
    .in('student_id', studentIds.length > 0 ? studentIds : ['none'])

  const submissionSet = new Set((allSubmissions || []).map(s => `${s.student_id}:${s.homework_item_id}`))
  const lateSet = new Set((allSubmissions || []).filter(s => s.is_late).map(s => `${s.student_id}:${s.homework_item_id}`))

  // Per-week stats (past weeks only)
  const pastWeeks = (weeks || []).filter(w => new Date(w.due_date) < new Date())
  const weekStats = pastWeeks.map(week => {
    const weekItems = (allItems || []).filter(i => i.week_id === week.id)
    const totalPossible = weekItems.length * (students || []).length
    const submitted = (allSubmissions || []).filter(s => weekItems.some(i => i.id === s.homework_item_id)).length
    const lateCount = (allSubmissions || []).filter(s => s.is_late && weekItems.some(i => i.id === s.homework_item_id)).length
    const completionRate = totalPossible > 0 ? Math.round((submitted / totalPossible) * 100) : 0
    return { ...week, completionRate, lateCount, totalSubmissions: submitted, totalPossible }
  })

  // Per-student stats
  const studentStats = (students || []).map(student => {
    const totalItems = (allItems || []).length
    const completed = (allSubmissions || []).filter(s => s.student_id === student.id).length
    const late = (allSubmissions || []).filter(s => s.student_id === student.id && s.is_late).length
    const overdue = pastWeeks.reduce((count, week) => {
      const weekItems = (allItems || []).filter(i => i.week_id === week.id)
      const weekCompleted = weekItems.filter(i => submissionSet.has(`${student.id}:${i.id}`)).length
      return count + (weekCompleted < weekItems.length ? 1 : 0)
    }, 0)
    return { ...student, completed, late, overdue, totalItems }
  })

  const overdueStudents = studentStats.filter(s => s.overdue > 0)

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Reports</h1>
        <p className="text-sm text-gray-400 mt-1">{schoolYear?.name}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Students with overdue work</p>
          <p className="text-2xl font-medium text-gray-900">{overdueStudents.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">of {(students || []).length} total</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Avg completion rate</p>
          <p className="text-2xl font-medium text-gray-900">
            {weekStats.length > 0 ? Math.round(weekStats.reduce((sum, w) => sum + w.completionRate, 0) / weekStats.length) : 0}%
          </p>
          <p className="text-xs text-gray-400 mt-0.5">across all past weeks</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Late submissions</p>
          <p className="text-2xl font-medium text-gray-900">{lateSet.size}</p>
          <p className="text-xs text-gray-400 mt-0.5">total across all weeks</p>
        </div>
      </div>

      {/* Weekly breakdown */}
      {weekStats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Weekly completion</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Week</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Due</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Completion</th>
                  <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Late</th>
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
                    <td className="px-4 py-3 text-right text-gray-400">{week.lateCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-student breakdown */}
      <div>
        <h2 className="text-sm font-medium text-gray-700 mb-3">Student breakdown</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Student</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Completed</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Late</th>
                <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Overdue weeks</th>
              </tr>
            </thead>
            <tbody>
              {studentStats.map((student, i) => (
                <tr key={student.id} className={i < studentStats.length - 1 ? 'border-b border-gray-50' : ''}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{student.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">{student.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{student.completed}/{student.totalItems}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{student.late}</td>
                  <td className="px-4 py-3 text-right">
                    {student.overdue > 0
                      ? <span className="text-red-500 font-medium">{student.overdue}</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                </tr>
              ))}
              {studentStats.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">No students enrolled yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
