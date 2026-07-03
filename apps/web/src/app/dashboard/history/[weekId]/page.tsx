import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import HomeworkFeed from '@/components/HomeworkFeed'

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
    .select('id, type, title, description, external_url, content, sort_order, show_attribution')
    .eq('week_id', weekId)
    .order('sort_order', { ascending: true })

  const itemIds = (items || []).map(i => i.id)
  const { data: submissions } = await supabase
    .from('submissions')
    .select('homework_item_id, completed_at, is_late, response_text')
    .eq('student_id', user.id)
    .in('homework_item_id', itemIds.length > 0 ? itemIds : ['none'])

  const submissionMap = new Map(
    (submissions || []).map(s => [s.homework_item_id, s])
  )

  const feedItems = (items || []).map(item => {
    const submission = submissionMap.get(item.id)
    return {
      ...item,
      completed: !!submission,
      response: submission?.response_text ?? null,
    }
  })

  const dueDate = new Date(week.due_date)
  const completedCount = feedItems.filter(i => i.completed).length

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
          {completedCount} of {feedItems.length} completed
        </p>
      </div>

      <HomeworkFeed
        items={feedItems}
        studentId={user.id}
        weekId={week.id}
        weekDueDate={week.due_date}
      />
    </div>
  )
}
