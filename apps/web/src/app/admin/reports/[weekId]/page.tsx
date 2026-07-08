import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const typeLabels: Record<string, string> = {
  bible_reading: 'Scripture Reading',
  book_reading: 'Book Reading',
  video: 'Video',
  reflection: 'Reflection',
}

export default async function WeekReportPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params
  const supabase = await createClient()

  const { data: week } = await supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('id', weekId)
    .single()

  if (!week) notFound()

  const [{ data: items }, { data: students }] = await Promise.all([
    supabase
      .from('homework_items')
      .select('id, type, title, sort_order')
      .eq('week_id', weekId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'student')
      .order('full_name', { ascending: true }),
  ])

  const itemIds = (items || []).map(i => i.id)
  const studentIds = (students || []).map(s => s.id)

  const { data: submissions } = await supabase
    .from('submissions')
    .select('student_id, homework_item_id, is_late, response_text, response_file_path, response_file_name')
    .in('homework_item_id', itemIds.length > 0 ? itemIds : ['none'])
    .in('student_id', studentIds.length > 0 ? studentIds : ['none'])

  // Signed URLs for uploaded journal photos (private bucket)
  const admin = createAdminClient()
  const fileUrls = new Map<string, string>()
  for (const s of submissions || []) {
    if (!s.response_file_path) continue
    const { data: signed } = await admin.storage
      .from('homework-uploads')
      .createSignedUrl(s.response_file_path, 3600)
    if (signed?.signedUrl) fileUrls.set(s.response_file_path, signed.signedUrl)
  }

  const submissionMap = new Map(
    (submissions || []).map(s => [`${s.student_id}:${s.homework_item_id}`, s])
  )

  return (
    <div className="max-w-none">
      <Link href="/admin/reports" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Reports
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Week {week.week_number} — {week.title}</h1>
        <p className="text-sm text-gray-400 mt-1">
          Due {new Date(week.due_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {' · '}Use Cmd+F (or Ctrl+F) to find a student
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 sticky left-0 bg-white whitespace-nowrap">Student</th>
              {(items || []).map(item => (
                <th key={item.id} className="text-left text-xs font-medium text-gray-400 px-4 py-3 min-w-[220px] align-bottom">
                  <span className="block text-[10px] text-gray-300 uppercase tracking-wide mb-0.5">{typeLabels[item.type] || item.type}</span>
                  {item.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(students || []).map((student, i) => (
              <tr key={student.id} className={i < (students || []).length - 1 ? 'border-b border-gray-50' : ''}>
                <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white whitespace-nowrap">
                  {student.full_name || student.email}
                </td>
                {(items || []).map(item => {
                  const submission = submissionMap.get(`${student.id}:${item.id}`)
                  return (
                    <td key={item.id} className="px-4 py-3 align-top">
                      {item.type === 'reflection' ? (
                        submission?.response_text || submission?.response_file_path ? (
                          <div>
                            <p className="text-xs font-medium text-green-600 mb-1">
                              Submitted{submission.is_late ? ' (late)' : ''}
                            </p>
                            {submission.response_text && (
                              <p className="text-sm text-gray-700 whitespace-pre-line">{submission.response_text}</p>
                            )}
                            {submission.response_file_path && (
                              fileUrls.get(submission.response_file_path) ? (
                                <a href={fileUrls.get(submission.response_file_path)} target="_blank" rel="noopener noreferrer" className="inline-block mt-1">
                                  {/\.(jpe?g|png|heic|heif|webp|gif)$/i.test(submission.response_file_path) ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={fileUrls.get(submission.response_file_path)} alt="Journal upload" className="max-h-40 rounded-lg border border-gray-200" />
                                  ) : (
                                    <span className="text-sm text-blue-600 underline">📎 {submission.response_file_name ?? 'Uploaded file'}</span>
                                  )}
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">📎 {submission.response_file_name ?? 'Uploaded file'}</span>
                              )
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-red-500">Not submitted</span>
                        )
                      ) : submission ? (
                        <span className="text-sm text-green-600 font-medium">
                          Done{submission.is_late ? ' (late)' : ''}
                        </span>
                      ) : (
                        <span className="text-sm text-red-500">Not done</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {(students || []).length === 0 && (
              <tr><td colSpan={(items || []).length + 1} className="px-4 py-6 text-center text-gray-400 text-sm">No students enrolled yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
