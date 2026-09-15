import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDueDate } from '@/lib/dueDate'
import { getEmbedUrl } from '@/lib/videoEmbed'

export default async function RecordingDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: week }, { data: recording }] = await Promise.all([
    supabase.from('weeks').select('id, week_number, title, due_date').eq('id', weekId).single(),
    supabase
      .from('recordings')
      .select('title, speaker, video_url, recorded_on, description')
      .eq('week_id', weekId)
      .maybeSingle(),
  ])

  // An unpublished week is a 404 rather than an empty player, so guessing a
  // week id doesn't reveal a draft recording.
  if (!week || !recording?.video_url) notFound()

  const embedUrl = getEmbedUrl(recording.video_url)
  const meta = [
    formatDueDate(recording.recorded_on ?? week.due_date, { weekday: 'long', month: 'long', day: 'numeric' }),
    recording.speaker,
  ].filter(Boolean).join(' · ')

  return (
    <div className="max-w-3xl">
      {/* Back link */}
      <Link href="/dashboard/recordings" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All recordings
      </Link>

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-gray-400">Week {week.week_number}</p>
        <h1 className="text-2xl font-medium text-gray-900 mt-0.5">{recording.title}</h1>
        <p className="text-sm text-gray-400 mt-1">{meta}</p>
      </div>

      {embedUrl ? (
        <div className="aspect-video w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-900">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <a
          href={recording.video_url.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Watch recording →
        </a>
      )}

      {recording.description && (
        <p className="text-sm text-gray-500 mt-5 whitespace-pre-line">{recording.description}</p>
      )}
    </div>
  )
}
