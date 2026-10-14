import { createClient } from '@/lib/supabase/server'
import { formatSubmittedAt } from '@/lib/dueDate'
import { signedUploadUrls } from '@/lib/homeworkUploads'
import { contactsForStudents, type StudentContact } from '@/lib/studentContacts'
import type { Reflection } from '@/components/admin/ReflectionDrawer'
import type { FeedReflection, WeekOption, GroupOption, StudentOption } from '@/components/ReflectionsFeed'

const IMAGE_FILE = /\.(jpe?g|png|heic|heif|webp|gif)$/i

export type ReflectionsFeedData = {
  schoolYearName: string | null
  reflections: FeedReflection[]
  weeks: WeekOption[]
  groups: GroupOption[]
  students: StudentOption[]
}

/**
 * Every handed-in reflection for the active school year, newest first.
 *
 * `groupId` narrows the feed to one group — the group leader view. RLS would
 * already limit a leader to their own group, but the explicit filter keeps the
 * scope from resting on policy alone.
 *
 * `includeContacts` reads phone numbers through the service-role client, which
 * bypasses the column-level REVOKE on `profiles.phone` — only pass it from
 * behind the admin gate.
 */
export async function loadReflectionsFeed({
  groupId,
  includeContacts,
}: {
  groupId?: string
  includeContacts: boolean
}): Promise<ReflectionsFeedData> {
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

  let studentsQuery = supabase
    .from('profiles')
    .select('id, full_name, email, group_id')
    .eq('role', 'student')
    .order('full_name', { ascending: true })
  let groupsQuery = supabase
    .from('groups')
    .select('id, name')
    .eq('school_year_id', schoolYear?.id ?? '')
    .order('name', { ascending: true })
  if (groupId) {
    studentsQuery = studentsQuery.eq('group_id', groupId)
    groupsQuery = groupsQuery.eq('id', groupId)
  }

  const [{ data: items }, { data: students }, { data: groups }] = await Promise.all([
    supabase
      .from('homework_items')
      .select('id, week_id, title')
      .eq('type', 'reflection')
      .in('week_id', weekIds.length > 0 ? weekIds : ['none']),
    studentsQuery,
    groupsQuery,
  ])

  const itemIds = (items || []).map(i => i.id)
  const studentIds = (students || []).map(s => s.id)

  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, student_id, homework_item_id, is_late, completed_at, response_text, response_file_path, response_file_name, response_file_rotation')
    .in('homework_item_id', itemIds.length > 0 ? itemIds : ['none'])
    .in('student_id', studentIds.length > 0 ? studentIds : ['none'])

  // Group name and phone are the point of the admin page — they turn "I read
  // something worth responding to" into a text message without a detour through
  // Students. Leaders get the group name only.
  const groupNames = new Map((groups || []).map(g => [g.id, g.name]))
  const [fileUrls, contacts] = await Promise.all([
    signedUploadUrls((submissions || []).map(s => s.response_file_path)),
    includeContacts
      ? contactsForStudents(students || [])
      : Promise.resolve(new Map<string, StudentContact>(
          (students || []).map(s => [s.id, {
            groupName: s.group_id ? groupNames.get(s.group_id) ?? null : null,
            phone: null,
            phoneHref: null,
          }])
        )),
  ])

  const weekById = new Map((weeks || []).map(w => [w.id, w]))
  const itemById = new Map((items || []).map(i => [i.id, i]))
  const studentById = new Map((students || []).map(s => [s.id, s]))

  // Unlike the week grid, this lists only work that was actually handed in, so
  // reading-plan visibility never comes into it.
  const reflections: FeedReflection[] = []
  for (const submission of submissions || []) {
    if (!submission.response_text && !submission.response_file_path) continue

    const item = itemById.get(submission.homework_item_id)
    const student = studentById.get(submission.student_id)
    const week = item ? weekById.get(item.week_id) : undefined
    if (!item || !student || !week) continue

    const contact = contacts.get(student.id)
    const reflection: Reflection = {
      key: `${student.id}:${item.id}`,
      submissionId: submission.id,
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
      rotation: submission.response_file_rotation ?? 0,
      isLate: !!submission.is_late,
      completedAt: submission.completed_at ?? null,
      completedLabel: formatSubmittedAt(submission.completed_at),
    }
    reflections.push({ ...reflection, weekId: week.id, studentId: student.id, groupId: student.group_id ?? null })
  }
  reflections.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))

  return {
    schoolYearName: schoolYear?.name ?? null,
    reflections,
    weeks: (weeks || []).map(w => ({ id: w.id, label: `Week ${w.week_number} — ${w.title}` })),
    groups: (groups || []).map(g => ({ id: g.id, name: g.name })),
    // Every student, not just the ones who have submitted: an empty result answers
    // "did they hand anything in?" where a missing name would only raise the question.
    students: (students || []).map(s => ({ id: s.id, name: s.full_name || s.email, groupId: s.group_id ?? null })),
  }
}
