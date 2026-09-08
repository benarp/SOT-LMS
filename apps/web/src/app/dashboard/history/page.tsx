import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { asBiblePlan, frozenMap, visibleItems } from '@/lib/biblePlan'
import { dueDay, formatDueDate, isPastDue, schoolToday } from '@/lib/dueDate'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_active', true)
    .single()

  if (!schoolYear) {
    return (
      <div>
        <h1 className="text-2xl font-medium text-gray-900">Curriculum</h1>
        <p className="mt-4 text-sm text-gray-400">No active school year.</p>
      </div>
    )
  }

  // The whole year in order, not just what's already due — students use this
  // to read ahead. Weeks with no curriculum loaded yet are dropped below, so
  // the list grows on its own as content lands rather than showing empty rows.
  const { data: weeks } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('school_year_id', schoolYear.id)
    .order('week_number', { ascending: true })

  if (!weeks || weeks.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-medium text-gray-900">Curriculum</h1>
        <p className="mt-4 text-sm text-gray-400">No curriculum yet — check back after your first class.</p>
      </div>
    )
  }

  // Get all homework items for these weeks, narrowed to the student's reading
  // plan as it stood in each week (past weeks may be frozen to an older plan).
  const weekIds = weeks.map(w => w.id)
  const [{ data: allItems }, { data: profile }, { data: frozenRows }] = await Promise.all([
    supabase.from('homework_items').select('id, week_id, bible_plan').in('week_id', weekIds),
    supabase.from('profiles').select('bible_plan').eq('id', user.id).single(),
    supabase.from('student_week_plans').select('week_id, plan').eq('student_id', user.id).in('week_id', weekIds),
  ])

  const items = visibleItems(allItems, asBiblePlan(profile?.bible_plan), frozenMap(frozenRows))

  // Get all submissions for this student
  const itemIds = (items || []).map(i => i.id)
  const { data: submissions } = await supabase
    .from('submissions')
    .select('homework_item_id')
    .eq('student_id', user.id)
    .in('homework_item_id', itemIds.length > 0 ? itemIds : ['none'])

  const submittedIds = new Set((submissions || []).map(s => s.homework_item_id))

  // Build per-week completion counts, keeping only weeks that actually have
  // something in them for this student's plan.
  const weekStats = weeks
    .map(week => {
      const weekItems = (items || []).filter(i => i.week_id === week.id)
      const completed = weekItems.filter(i => submittedIds.has(i.id)).length
      return {
        ...week,
        total: weekItems.length,
        completed,
        upcoming: !isPastDue(week.due_date) && dueDay(week.due_date) !== schoolToday(),
      }
    })
    .filter(week => week.total > 0)

  if (weekStats.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-medium text-gray-900">Curriculum</h1>
        <p className="mt-4 text-sm text-gray-400">No curriculum yet — check back after your first class.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Curriculum</h1>
        <p className="text-sm text-gray-400 mt-1">{schoolYear.name}</p>
      </div>

      <div className="space-y-2">
        {weekStats.map(week => {
          const allDone = week.total > 0 && week.completed === week.total
          const noneDone = week.completed === 0

          return (
            <Link
              key={week.id}
              href={`/dashboard/history/${week.id}`}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-gray-300 transition-colors group"
            >
              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                allDone ? 'bg-green-500' : noneDone ? 'bg-gray-200' : 'bg-amber-400'
              }`} />

              {/* Week info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{week.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Due {formatDueDate(week.due_date)}
                  {week.upcoming && <span className="ml-2 text-gray-300">· Upcoming</span>}
                </p>
              </div>

              {/* Completion */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-sm ${allDone ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                  {week.completed}/{week.total}
                </span>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
