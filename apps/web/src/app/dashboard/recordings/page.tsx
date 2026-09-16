import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDueDate } from '@/lib/dueDate'

type Recording = {
  week_id: string
  title: string
  speaker: string | null
  video_url: string | null
  recorded_on: string | null
}

export default async function RecordingsPage() {
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
        <h1 className="text-2xl font-medium text-gray-900">Recordings</h1>
        <p className="mt-4 text-sm text-gray-400">No active school year.</p>
      </div>
    )
  }

  // Every week of the year, not just the ones with a recording — a week with
  // nothing posted yet shows as a grayed row so the shape of the year is
  // visible from day one. (Curriculum filters empty weeks out; this doesn't.)
  const { data: weeks } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('school_year_id', schoolYear.id)
    .order('week_number', { ascending: true })

  if (!weeks || weeks.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-medium text-gray-900">Recordings</h1>
        <p className="mt-4 text-sm text-gray-400">No weeks scheduled yet — check back after your first class.</p>
      </div>
    )
  }

  const weekIds = weeks.map(w => w.id)
  const { data: recordings } = await supabase
    .from('recordings')
    .select('week_id, title, speaker, video_url, recorded_on')
    .in('week_id', weekIds.length > 0 ? weekIds : ['none'])

  const byWeek = new Map<string, Recording>(
    (recordings || []).map((r: Recording) => [r.week_id, r]),
  )

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Recordings</h1>
        <p className="text-sm text-gray-400 mt-1">{schoolYear.name}</p>
      </div>

      <div className="space-y-2">
        {weeks.map(week => {
          const rec = byWeek.get(week.id)
          // A recording only counts as posted once it has a link — an admin can
          // save the title and speaker ahead of the upload without publishing.
          const published = !!rec?.video_url

          if (!published) {
            return (
              <div
                key={week.id}
                className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3.5 opacity-60"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xs font-medium text-gray-400 flex-shrink-0">
                  {week.week_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-400 truncate">{week.title}</p>
                  <p className="text-xs text-gray-300 mt-0.5">Not posted yet</p>
                </div>
              </div>
            )
          }

          const meta = [
            formatDueDate(rec!.recorded_on ?? week.due_date, { month: 'short', day: 'numeric' }),
            rec!.speaker,
          ].filter(Boolean).join(' · ')

          return (
            <Link
              key={week.id}
              href={`/dashboard/recordings/${week.id}`}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-gray-300 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xs font-medium text-gray-500 flex-shrink-0">
                {week.week_number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{rec!.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{meta}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
