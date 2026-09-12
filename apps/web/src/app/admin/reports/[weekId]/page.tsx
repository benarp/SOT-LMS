import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BIBLE_PLAN_LABELS, asBiblePlan, frozenMapByStudent, itemVisibleToPlan, planForWeek } from '@/lib/biblePlan'
import { formatDueDate, formatSubmittedAt } from '@/lib/dueDate'
import { signedUploadUrls } from '@/lib/homeworkUploads'
import { contactsForStudents } from '@/lib/studentContacts'
import WeekReportView, { type Column, type Reflection, type Row } from './WeekReportView'

const typeLabels: Record<string, string> = {
  bible_reading: 'Scripture Reading',
  book_reading: 'Book Reading',
  video: 'Video',
  reflection: 'Reflection',
}

const IMAGE_FILE = /\.(jpe?g|png|heic|heif|webp|gif)$/i

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
      .select('id, type, title, sort_order, bible_plan')
      .eq('week_id', weekId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, email, group_id, bible_plan')
      .eq('role', 'student')
      .order('full_name', { ascending: true }),
  ])

  const itemIds = (items || []).map(i => i.id)
  const studentIds = (students || []).map(s => s.id)

  // Admins see every item as a column, but a student on the other reading plan
  // was never assigned some of them — those cells render "n/a", not "Not done".
  const { data: frozenRows } = await supabase
    .from('student_week_plans')
    .select('student_id, week_id, plan')
    .eq('week_id', weekId)
    .in('student_id', studentIds.length > 0 ? studentIds : ['none'])

  const frozenByStudent = frozenMapByStudent(frozenRows)
  const planOf = (student: { id: string; bible_plan?: string | null }) =>
    planForWeek(weekId, asBiblePlan(student.bible_plan), frozenByStudent.get(student.id))

  const { data: submissions } = await supabase
    .from('submissions')
    .select('student_id, homework_item_id, is_late, completed_at, response_text, response_file_path, response_file_name')
    .in('homework_item_id', itemIds.length > 0 ? itemIds : ['none'])
    .in('student_id', studentIds.length > 0 ? studentIds : ['none'])

  const [fileUrls, contacts] = await Promise.all([
    signedUploadUrls((submissions || []).map(s => s.response_file_path)),
    contactsForStudents(students || []),
  ])

  const submissionMap = new Map(
    (submissions || []).map(s => [`${s.student_id}:${s.homework_item_id}`, s])
  )

  const weekLabel = `Week ${week.week_number} — ${week.title}`

  const columns: Column[] = (items || []).map(item => ({
    id: item.id,
    type: item.type,
    title: item.title,
    typeLabel: typeLabels[item.type] || item.type,
  }))

  // One flat list of every reflection actually handed in. The grid cells and the
  // drawer's Previous/Next both index into this same array, so they can never
  // disagree about what comes next.
  const reflections: Reflection[] = []
  for (const student of students || []) {
    const plan = planOf(student)
    const contact = contacts.get(student.id)
    for (const item of (items || []).filter(i => i.type === 'reflection')) {
      if (!itemVisibleToPlan(item, plan)) continue
      const submission = submissionMap.get(`${student.id}:${item.id}`)
      if (!submission?.response_text && !submission?.response_file_path) continue
      reflections.push({
        key: `${student.id}:${item.id}`,
        studentName: student.full_name || student.email,
        groupName: contact?.groupName ?? null,
        phone: contact?.phone ?? null,
        phoneHref: contact?.phoneHref ?? null,
        weekLabel,
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
  }
  reflections.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
  const indexByKey = new Map(reflections.map((r, i) => [r.key, i]))

  const rows: Row[] = (students || []).map(student => {
    const plan = planOf(student)
    return {
      id: student.id,
      name: student.full_name || student.email,
      planLabel: BIBLE_PLAN_LABELS[plan],
      cells: (items || []).map(item => {
        if (!itemVisibleToPlan(item, plan)) return { itemId: item.id, state: 'na' }
        if (item.type === 'reflection') {
          const index = indexByKey.get(`${student.id}:${item.id}`)
          if (index === undefined) return { itemId: item.id, state: 'missing' }
          const reflection = reflections[index]
          return {
            itemId: item.id,
            state: 'reflection',
            reflectionIndex: index,
            text: reflection.text,
            isLate: reflection.isLate,
            fileUrl: reflection.fileUrl,
            fileName: reflection.fileName,
            isImage: reflection.isImage,
          }
        }
        const submission = submissionMap.get(`${student.id}:${item.id}`)
        return submission
          ? { itemId: item.id, state: 'done', isLate: !!submission.is_late }
          : { itemId: item.id, state: 'missing' }
      }),
    }
  })

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
          Due {formatDueDate(week.due_date, { weekday: 'long', month: 'long', day: 'numeric' })}
          {' · '}Use Cmd+F (or Ctrl+F) to find a student
        </p>
      </div>

      <WeekReportView columns={columns} rows={rows} reflections={reflections} />
    </div>
  )
}
