import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import AddHomeworkItemForm from '@/components/admin/AddHomeworkItemForm'
import HomeworkItemList from '@/components/admin/HomeworkItemList'
import { formatDueDate } from '@/lib/dueDate'

export default async function WeekEditPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params
  const supabase = await createClient()

  const { data: week } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('id', weekId)
    .single()

  if (!week) notFound()

  const { data: items } = await supabase
    .from('homework_items')
    .select('id, type, title, description, external_url, content, sort_order, show_attribution, bible_plan')
    .eq('week_id', weekId)
    .order('sort_order', { ascending: true })

  return (
    <div className="max-w-2xl">
      <Link href="/admin/curriculum" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Curriculum
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">{week.title}</h1>
        <p className="text-sm text-gray-400 mt-1">
          Due {formatDueDate(week.due_date, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Homework items */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Homework items</h2>
        <HomeworkItemList items={items || []} weekId={weekId} />
      </div>

      <AddHomeworkItemForm weekId={weekId} nextSortOrder={(items || []).length + 1} />
    </div>
  )
}
