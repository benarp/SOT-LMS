import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

const typeLabels: Record<string, string> = {
  bible_reading: 'Scripture Reading',
  book_reading: 'Book Reading',
  video: 'Video',
  reflection: 'Reflection',
}

export default async function LeaderStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leaderProfile } = await supabase
    .from('profiles')
    .select('group_id')
    .eq('id', user.id)
    .single()

  const { data: student } = await supabase
    .from('profiles')
    .select('id, full_name, email, group_id')
    .eq('id', studentId)
    .single()

  if (!student || student.group_id !== leaderProfile?.group_id) notFound()

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const { data: weeks } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('school_year_id', schoolYear?.id || '')
    .order('week_number', { ascending: false })

  const weekIds = (weeks || []).map(w => w.id)
  const { data: items } = await supabase
    .from('homework_items')
    .select('id, week_id, type, title, sort_order')
    .in('week_id', weekIds.length > 0 ? weekIds : ['none'])
    .order('sort_order', { ascending: true })

  const itemIds = (items || []).map(i => i.id)
  const { data: submissions } = await supabase
    .from('submissions')
    .select('homework_item_id, completed_at, is_late')
    .eq('student_id', studentId)
    .in('homework_item_id', itemIds.length > 0 ? itemIds : ['none'])

  const submissionMap = new Map((submissions || []).map(s => [s.homework_item_id, s]))

  return (
    <div className="max-w-2xl">
      <Link href="/leader/students" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Students
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">{student.full_name || '—'}</h1>
        <p className="text-sm text-gray-400 mt-1">{student.email}</p>
      </div>

      <div className="space-y-4">
        {(weeks || []).map(week => {
          const weekItems = (items || []).filter(i => i.week_id === week.id)
          const completedCount = weekItems.filter(i => submissionMap.has(i.id)).length
          const isPast = new Date(week.due_date) < new Date()
          if (!isPast) return null

          return (
            <div key={week.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{week.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Due {new Date(week.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className={`text-sm font-medium ${completedCount === weekItems.length ? 'text-green-600' : 'text-red-500'}`}>
                  {completedCount}/{weekItems.length}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {weekItems.map(item => {
                  const sub = submissionMap.get(item.id)
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${sub ? 'bg-gray-900 border-gray-900' : 'border-gray-200'}`}>
                        {sub && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-400">{typeLabels[item.type]} · </span>
                        <span className={`text-sm ${sub ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.title}</span>
                      </div>
                      {sub && (
                        <span className={`text-xs flex-shrink-0 ${sub.is_late ? 'text-amber-500' : 'text-green-500'}`}>
                          {sub.is_late ? 'Late' : 'On time'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
