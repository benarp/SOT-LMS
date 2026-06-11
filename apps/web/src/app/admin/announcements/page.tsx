import { createClient } from '@/lib/supabase/server'
import CreateAnnouncementForm from '@/components/admin/CreateAnnouncementForm'
import DeleteAnnouncementButton from '@/components/admin/DeleteAnnouncementButton'
import SendWeeklyEmailButton from '@/components/admin/SendWeeklyEmailButton'
import SendTestEmailButton from '@/components/admin/SendTestEmailButton'

export default async function AnnouncementsPage() {
  const supabase = await createClient()

  const [{ data: announcements }, { data: schoolYear }] = await Promise.all([
    supabase.from('announcements').select('id, title, body, publish_at, created_at').order('publish_at', { ascending: false }),
    supabase.from('school_years').select('id').eq('is_active', true).single(),
  ])

  const { data: nextWeek } = schoolYear
    ? await supabase
        .from('weeks')
        .select('week_number, title, due_date')
        .eq('school_year_id', schoolYear.id)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(1)
        .single()
    : { data: null }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Announcements</h1>
        <p className="text-sm text-gray-400 mt-1">Published announcements appear on the student dashboard.</p>
      </div>

      {/* Send weekly email */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-gray-900 mb-0.5">Send weekly email</p>
            {nextWeek ? (
              <p className="text-sm text-gray-400">
                Will send Week {nextWeek.week_number} — <span className="text-gray-600">{nextWeek.title}</span>
                {' '}· due {new Date(nextWeek.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' '}· with {(announcements || []).filter(a => new Date(a.publish_at) <= new Date()).length} active announcement{(announcements || []).filter(a => new Date(a.publish_at) <= new Date()).length !== 1 ? 's' : ''}
              </p>
            ) : (
              <p className="text-sm text-gray-400">No upcoming week found — add one in Curriculum first.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <SendTestEmailButton />
            <SendWeeklyEmailButton />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <CreateAnnouncementForm />
      </div>

      <div className="space-y-3">
        {(announcements || []).map(a => (
          <div key={a.id} className="bg-white border border-gray-200 rounded-xl px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{a.title}</p>
                <p className="text-sm text-gray-500 mt-1">{a.body}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(a.publish_at) > new Date()
                    ? `Scheduled for ${new Date(a.publish_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                    : `Published ${new Date(a.publish_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  }
                </p>
              </div>
              <DeleteAnnouncementButton id={a.id} />
            </div>
          </div>
        ))}
        {(announcements || []).length === 0 && (
          <p className="text-sm text-gray-400 py-4">No announcements yet.</p>
        )}
      </div>
    </div>
  )
}
