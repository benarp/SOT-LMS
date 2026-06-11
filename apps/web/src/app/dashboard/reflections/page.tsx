import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReflectionCard from '@/components/ReflectionCard'

export default async function ReflectionsPage() {
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
        <h1 className="text-2xl font-medium text-gray-900">Book reflections</h1>
        <p className="mt-4 text-sm text-gray-400">No active school year.</p>
      </div>
    )
  }

  const { data: books } = await supabase
    .from('books')
    .select('id, title, author, sort_order')
    .eq('school_year_id', schoolYear.id)
    .order('sort_order', { ascending: true })

  const bookIds = (books || []).map(b => b.id)
  const { data: submissions } = await supabase
    .from('book_reflections')
    .select('book_id, content, file_url, submitted_at')
    .eq('student_id', user.id)
    .in('book_id', bookIds.length > 0 ? bookIds : ['none'])

  const submissionMap = new Map(
    (submissions || []).map(s => [s.book_id, s])
  )

  const completedCount = (books || []).filter(b => submissionMap.has(b.id)).length

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Book reflections</h1>
        <p className="text-sm text-gray-400 mt-1">
          {schoolYear.name} · {completedCount} of {(books || []).length} submitted
        </p>
      </div>

      <div className="space-y-4">
        {(books || []).map(book => (
          <ReflectionCard
            key={book.id}
            book={book}
            submission={submissionMap.get(book.id) || null}
          />
        ))}
      </div>
    </div>
  )
}
