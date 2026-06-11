import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

const typeLabels: Record<string, string> = {
  bible_reading: 'Bible reading',
  video: 'Video',
  book_reflection: 'Book reflection',
  written: 'Written submission',
}

export default async function WeekDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: week } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date, school_year_id')
    .eq('id', weekId)
    .single()

  if (!week) notFound()

  const { data: items } = await supabase
    .from('homework_items')
    .select('id, type, title, description, external_url, sort_order')
    .eq('week_id', weekId)
    .order('sort_order', { ascending: true })

  const itemIds = (items || []).map(i => i.id)
  const { data: submissions } = await supabase
    .from('submissions')
    .select('homework_item_id, completed_at, is_late')
    .eq('student_id', user.id)
    .in('homework_item_id', itemIds.length > 0 ? itemIds : ['none'])

  const submissionMap = new Map(
    (submissions || []).map(s => [s.homework_item_id, s])
  )

  const dueDate = new Date(week.due_date)
  const completedCount = (items || []).filter(i => submissionMap.has(i.id)).length

  return (
    <div className="max-w-2xl">
      {/* Back link */}
      <Link href="/dashboard/history" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Previous weeks
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">{week.title}</h1>
        <p className="text-sm text-gray-400 mt-1">
          Due {dueDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {' · '}
          {completedCount} of {(items || []).length} completed
        </p>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {(items || []).map(item => {
          const submission = submissionMap.get(item.id)
          const done = !!submission

          return (
            <div key={item.id} className={`bg-white border rounded-xl px-4 py-3.5 ${done ? 'border-gray-100' : 'border-gray-200'}`}>
              <div className="flex items-start gap-4">
                {/* Check indicator */}
                <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  done ? 'bg-gray-900 border-gray-900' : 'border-gray-200'
                }`}>
                  {done && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5">{typeLabels[item.type] || item.type}</p>
                  <p className={`text-sm font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                  )}
                  {submission && (
                    <p className="text-xs mt-1.5 flex items-center gap-1">
                      <span className={submission.is_late ? 'text-amber-500' : 'text-green-500'}>
                        {submission.is_late ? 'Submitted late' : 'Submitted on time'}
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-400">
                        {new Date(submission.completed_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
