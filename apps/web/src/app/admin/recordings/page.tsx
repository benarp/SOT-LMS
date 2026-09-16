import { createClient } from '@/lib/supabase/server'
import RecordingForm from '@/components/admin/RecordingForm'

type Recording = {
  week_id: string
  title: string
  speaker: string | null
  video_url: string | null
  recorded_on: string | null
  description: string | null
}

export default async function AdminRecordingsPage() {
  const supabase = await createClient()

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const { data: weeks } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('school_year_id', schoolYear?.id || '')
    .order('week_number', { ascending: true })

  const weekIds = (weeks || []).map(w => w.id)
  const { data: recordings } = await supabase
    .from('recordings')
    .select('week_id, title, speaker, video_url, recorded_on, description')
    .in('week_id', weekIds.length > 0 ? weekIds : ['none'])

  const byWeek = new Map<string, Recording>(
    (recordings || []).map((r: Recording) => [r.week_id, r]),
  )

  const published = (weeks || []).filter(w => byWeek.get(w.id)?.video_url).length

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Recordings</h1>
        <p className="text-sm text-gray-400 mt-1">
          {schoolYear?.name ?? 'No active school year'}
          {weeks && weeks.length > 0 && ` · ${published} of ${weeks.length} posted`}
        </p>
      </div>

      <div className="space-y-2">
        {(weeks || []).map(week => (
          <RecordingForm
            key={week.id}
            week={{ id: week.id, week_number: week.week_number, title: week.title, due_date: week.due_date }}
            recording={byWeek.get(week.id) ?? null}
          />
        ))}

        {(weeks || []).length === 0 && (
          <p className="text-sm text-gray-400 py-4">No weeks added yet — add them under Curriculum first.</p>
        )}
      </div>
    </div>
  )
}
