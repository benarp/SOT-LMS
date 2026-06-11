import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import AddHomeworkItemForm from '@/components/admin/AddHomeworkItemForm'
import DeleteItemButton from '@/components/admin/DeleteItemButton'
import EditItemButton from '@/components/admin/EditItemButton'

const typeLabels: Record<string, string> = {
  bible_reading: 'Bible reading',
  video: 'Video',
  book_reflection: 'Book reflection',
  written: 'Written submission',
}

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
    .select('id, type, title, description, external_url, content, sort_order')
    .eq('week_id', weekId)
    .order('sort_order', { ascending: true })

  const { data: books } = await supabase
    .from('books')
    .select('id, title')
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
          Due {new Date(week.due_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Homework items */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Homework items</h2>
        <div className="space-y-2">
          {(items || []).map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3.5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">{typeLabels[item.type]}</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{item.title}</p>
                  {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                  {item.external_url && (
                    <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 mt-0.5 block truncate">{item.external_url}</a>
                  )}
                  {item.content && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 font-mono">{item.content}</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <EditItemButton item={item} />
                  <DeleteItemButton itemId={item.id} />
                </div>
              </div>
            </div>
          ))}
          {(items || []).length === 0 && (
            <p className="text-sm text-gray-400 py-2">No items yet.</p>
          )}
        </div>
      </div>

      <AddHomeworkItemForm weekId={weekId} books={books || []} nextSortOrder={(items || []).length + 1} />
    </div>
  )
}
