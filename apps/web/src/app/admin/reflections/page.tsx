import { createClient } from '@/lib/supabase/server'
import { formatSubmittedAt } from '@/lib/dueDate'
import { signedUploadUrls } from '@/lib/homeworkUploads'
import { contactsForStudents } from '@/lib/studentContacts'
import type { Reflection } from '@/components/admin/ReflectionDrawer'
import ReflectionsFeed, { type WeekOption } from './ReflectionsFeed'

const IMAGE_FILE = /\.(jpe?g|png|heic|heif|webp|gif)$/i

export default async function ReflectionsPage() {
  const supabase = await createClient()

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const { data: weeks } = await supabase
    .from('weeks')
    .select('id, week_number, title')
    .eq('school_year_id', schoolYear?.id || '')
    .order('week_number', { ascending: false })

  const weekIds = (weeks || []).map(w => w.id)

  const [{ data: items }, { data: students }] = await Promise.all([
    supabase
      .from('homework_items')
      .select('id, week_id, title')
      .eq('type', 'reflection')
      .in('week_id', weekIds.length > 0 ? weekIds : ['none']),
    supabase
      .from('profiles')
      .select('id, full_name, email, group_id')
      .eq('role', 'student')
      .order('full_name', { ascending: true }),
  ])

  const itemIds = (items || []).map(i => i.id)
  const studentIds = (students || []).map(s => s.id)

  const { data: submissions } = await supabase
    .from('submissions')
    .select('student_id, homework_item_id, is_late, completed_at, response_text, response_file_path, response_file_name')
    .in('homework_item_id', itemIds.length > 0 ? itemIds : ['none'])
    .in('student_id', studentIds.length > 0 ? studentIds : ['none'])

  // Group name and phone are the point of this page — they turn "I read something
  // worth responding to" into a text message without a detour through Students.
  const [fileUrls, contacts] = await Promise.all([
    signedUploadUrls((submissions || []).map(s => s.response_file_path)),
    contactsForStudents(students || []),
  ])

  const weekById = new Map((weeks || []).map(w => [w.id, w]))
  const itemById = new Map((items || []).map(i => [i.id, i]))
  const studentById = new Map((students || []).map(s => [s.id, s]))

  // Unlike the week grid, this lists only work that was actually handed in, so
  // reading-plan visibility never comes into it.
  const reflections: (Reflection & { weekId: string })[] = []
  for (const submission of submissions || []) {
    if (!submission.response_text && !submission.response_file_path) continue

    const item = itemById.get(submission.homework_item_id)
    const student = studentById.get(submission.student_id)
    const week = item ? weekById.get(item.week_id) : undefined
    if (!item || !student || !week) continue

    const contact = contacts.get(student.id)
    reflections.push({
      key: `${student.id}:${item.id}`,
      weekId: week.id,
      studentName: student.full_name || student.email,
      groupName: contact?.groupName ?? null,
      phone: contact?.phone ?? null,
      phoneHref: contact?.phoneHref ?? null,
      weekLabel: `Week ${week.week_number} — ${week.title}`,
      itemTitle: item.title,
      text: submission.response_text ?? null,
      fileUrl: submission.response_file_path ? fileUrls.get(submission.response_file_path) ?? null : null,
      fileName: submission.response_file_name ?? null,
      isImage: submission.response_file_path ? IMAGE_FILE.test(submission.response_file_path) : false,
      isLate: !!submission.is_late,
      completedAt: submission.completed_at ?? null,
      completedLabel: formatSubmittedAt(submission.completed_at),
    })
  }
  reflections.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))

  const weekOptions: WeekOption[] = (weeks || []).map(w => ({
    id: w.id,
    label: `Week ${w.week_number} — ${w.title}`,
  }))

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Reflections</h1>
        <p className="text-sm text-gray-400 mt-1">{schoolYear?.name} · newest first</p>
      </div>

      <ReflectionsFeed reflections={reflections} weeks={weekOptions} />
    </div>
  )
}
