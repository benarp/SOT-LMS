import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HomeworkFeed from '@/components/HomeworkFeed'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get active school year
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_active', true)
    .single()

  if (!schoolYear) {
    return (
      <div>
        <h1 className="text-2xl font-medium text-gray-900">Welcome back</h1>
        <p className="mt-4 text-gray-400 text-sm">No active school year. Ask your admin to set one up.</p>
      </div>
    )
  }

  // Get current week (most recent week with due_date >= today, or last week if between sessions)
  const { data: currentWeek } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('school_year_id', schoolYear.id)
    .gte('due_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('due_date', { ascending: true })
    .limit(1)
    .single()

  if (!currentWeek) {
    return (
      <div>
        <h1 className="text-2xl font-medium text-gray-900">Welcome back</h1>
        <p className="mt-4 text-gray-400 text-sm">No homework due this week. Check back soon.</p>
      </div>
    )
  }

  // Get homework items for this week
  const { data: items } = await supabase
    .from('homework_items')
    .select('id, type, title, description, external_url, content, book_id, sort_order')
    .eq('week_id', currentWeek.id)
    .order('sort_order', { ascending: true })

  // Get student's submissions for this week's items
  const itemIds = (items || []).map(i => i.id)
  const { data: submissions } = await supabase
    .from('submissions')
    .select('homework_item_id, completed_at, is_late, response_text')
    .eq('student_id', user.id)
    .in('homework_item_id', itemIds.length > 0 ? itemIds : ['none'])

  const submittedIds = new Set((submissions || []).map(s => s.homework_item_id))
  const responseByItem: Record<string, string> = {}
  for (const s of submissions || []) {
    if (s.response_text) responseByItem[s.homework_item_id] = s.response_text
  }

  // Get active announcements
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, title, body')
    .lte('publish_at', new Date().toISOString())
    .is('target_group_id', null)
    .order('publish_at', { ascending: false })
    .limit(3)

  const dueDate = new Date(currentWeek.due_date)
  const isOverdue = dueDate < new Date()

  return (
    <div className="max-w-2xl">
      {/* Announcements */}
      {(announcements || []).length > 0 && (
        <div className="mb-6 space-y-2">
          {announcements!.map(a => (
            <div key={a.id} className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-blue-900">{a.title}</p>
              <p className="text-sm text-blue-700 mt-0.5">{a.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Week header */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-1">{schoolYear.name}</p>
        <h1 className="text-2xl font-medium text-gray-900">{currentWeek.title}</h1>
        <p className={`text-sm mt-1 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
          {isOverdue ? 'Overdue — ' : 'Due '}
          {dueDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Progress */}
      {(items || []).length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">{submittedIds.size} of {items!.length} complete</span>
            {submittedIds.size === items!.length && (
              <span className="text-sm font-medium text-green-600">All done!</span>
            )}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-900 rounded-full transition-all duration-500"
              style={{ width: `${items!.length > 0 ? (submittedIds.size / items!.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Homework items */}
      <HomeworkFeed
        items={(items || []).map(item => ({
          ...item,
          completed: submittedIds.has(item.id),
          response: responseByItem[item.id] ?? null,
        }))}
        studentId={user.id}
        weekId={currentWeek.id}
        weekDueDate={currentWeek.due_date}
      />
    </div>
  )
}
