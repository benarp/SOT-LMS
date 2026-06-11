import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AddWeekForm from '@/components/admin/AddWeekForm'

export default async function CurriculumPage() {
  const supabase = await createClient()

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name, start_date, end_date')
    .eq('is_active', true)
    .single()

  const { data: weeks } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('school_year_id', schoolYear?.id || '')
    .order('week_number', { ascending: true })

  // Get item counts per week
  const weekIds = (weeks || []).map(w => w.id)
  const { data: items } = await supabase
    .from('homework_items')
    .select('id, week_id')
    .in('week_id', weekIds.length > 0 ? weekIds : ['none'])

  const itemCountMap = new Map<string, number>()
  ;(items || []).forEach(item => {
    itemCountMap.set(item.week_id, (itemCountMap.get(item.week_id) || 0) + 1)
  })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Curriculum</h1>
          <p className="text-sm text-gray-400 mt-1">{schoolYear?.name ?? 'No active school year'}</p>
        </div>
      </div>

      {/* Weeks list */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Weeks</h2>
        <div className="space-y-2">
          {(weeks || []).map(week => (
            <Link
              key={week.id}
              href={`/admin/curriculum/${week.id}`}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-gray-300 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                {week.week_number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{week.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Due {new Date(week.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' · '}
                  {itemCountMap.get(week.id) || 0} items
                </p>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}

          {(weeks || []).length === 0 && (
            <p className="text-sm text-gray-400 py-4">No weeks added yet.</p>
          )}
        </div>
      </div>

      {/* Add week form */}
      {schoolYear && <AddWeekForm schoolYearId={schoolYear.id} nextWeekNumber={(weeks || []).length} />}
    </div>
  )
}
