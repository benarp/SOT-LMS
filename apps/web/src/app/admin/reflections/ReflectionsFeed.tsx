'use client'

import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ReflectionDrawer, { type Reflection } from '@/components/admin/ReflectionDrawer'

export type WeekOption = {
  id: string
  label: string
}

export type GroupOption = {
  id: string
  name: string
}

export type StudentOption = {
  id: string
  name: string
  groupId: string | null
}

type FeedReflection = Reflection & {
  weekId: string
  studentId: string
  groupId: string | null
}

type Props = {
  reflections: FeedReflection[]
  weeks: WeekOption[]
  groups: GroupOption[]
  students: StudentOption[]
}

export default function ReflectionsFeed({ reflections, weeks, groups, students }: Props) {
  const searchParams = useSearchParams()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const lastTrigger = useRef<HTMLElement | null>(null)

  // The URL is the only filter state, so a filtered view can be bookmarked and shared.
  // Anything unrecognised falls back to 'all' — a bookmark that outlived its group,
  // or a hand-edited address, would otherwise leave the <select> rendering blank.
  const rawWeek = searchParams.get('week')
  const rawGroup = searchParams.get('group')
  const rawStudent = searchParams.get('student')

  const weekId = weeks.some(w => w.id === rawWeek) ? rawWeek! : 'all'
  const groupId = groups.some(g => g.id === rawGroup) ? rawGroup! : 'all'

  // Picking a group is a drill-down: the student list narrows to that group.
  const selectableStudents = useMemo(
    () => (groupId === 'all' ? students : students.filter(s => s.groupId === groupId)),
    [students, groupId]
  )

  // Validating against the narrowed list also settles a contradictory
  // ?group=…&student=… pair typed by hand: the group wins.
  const studentId = selectableStudents.some(s => s.id === rawStudent) ? rawStudent! : 'all'
  const isFiltered = weekId !== 'all' || groupId !== 'all' || studentId !== 'all'

  // The list arrives newest-first, so filtering preserves the order.
  const visible = useMemo(() => {
    let rows = reflections
    if (weekId !== 'all') rows = rows.filter(r => r.weekId === weekId)
    if (groupId !== 'all') rows = rows.filter(r => r.groupId === groupId)
    if (studentId !== 'all') rows = rows.filter(r => r.studentId === studentId)
    return rows
  }, [reflections, weekId, groupId, studentId])

  /**
   * history.pushState rather than router.push: it syncs with useSearchParams
   * without re-running the server component, which would re-query every
   * submission and re-sign every upload URL just to narrow a list already
   * held in memory.
   */
  function setFilters(next: Partial<Record<'week' | 'group' | 'student', string>>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === 'all') params.delete(key)
      else params.set(key, value)
    }
    const query = params.toString()
    window.history.pushState(null, '', query ? `?${query}` : window.location.pathname)
  }

  // Clearing the student in the same write keeps the two params from disagreeing.
  function chooseGroup(next: string) {
    const keeps = next === 'all' || students.find(s => s.id === studentId)?.groupId === next
    setFilters({ group: next, student: keeps ? studentId : 'all' })
  }

  // The drawer indexes into the filtered list, so tracking the open reflection by
  // index would point at the wrong one after a filter change — including one made
  // with the Back button, which never reaches setFilters. Identity survives both:
  // the drawer stays on the same reflection if it's still visible, and closes if
  // the new filter excludes it.
  const openIndex = openKey === null ? -1 : visible.findIndex(r => r.key === openKey)

  function openReflection(index: number, event: React.MouseEvent<HTMLElement>) {
    lastTrigger.current = event.currentTarget
    setOpenKey(visible[index]?.key ?? null)
  }

  function closeDrawer() {
    setOpenKey(null)
    lastTrigger.current?.focus()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={weekId}
          onChange={e => setFilters({ week: e.target.value })}
          aria-label="Filter by week"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          <option value="all">All weeks</option>
          {weeks.map(week => (
            <option key={week.id} value={week.id}>{week.label}</option>
          ))}
        </select>

        <select
          value={groupId}
          onChange={e => chooseGroup(e.target.value)}
          aria-label="Filter by group"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          <option value="all">All groups</option>
          {groups.map(group => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>

        <select
          value={studentId}
          onChange={e => setFilters({ student: e.target.value })}
          aria-label="Filter by student"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          <option value="all">All students</option>
          {selectableStudents.map(student => (
            <option key={student.id} value={student.id}>{student.name}</option>
          ))}
        </select>

        {isFiltered && (
          <button
            type="button"
            onClick={() => setFilters({ week: 'all', group: 'all', student: 'all' })}
            className="text-xs text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
          >
            Clear
          </button>
        )}

        <p className="text-xs text-gray-400 ml-auto">
          {isFiltered
            ? `${visible.length} of ${reflections.length} reflections`
            : `${visible.length} ${visible.length === 1 ? 'reflection' : 'reflections'}`}
        </p>
      </div>

      <div className="space-y-3">
        {visible.map((reflection, index) => (
          <div
            key={reflection.key}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-gray-900">{reflection.studentName}</p>
              <p className="text-xs text-gray-400 whitespace-nowrap">{reflection.completedLabel}</p>
            </div>

            <p className="text-xs text-gray-400 mt-0.5">
              {reflection.groupName ?? 'No group'}
              {reflection.phone && (
                <>
                  {' · '}
                  {reflection.phoneHref ? (
                    <a href={reflection.phoneHref} className="text-blue-600 hover:underline">{reflection.phone}</a>
                  ) : (
                    reflection.phone
                  )}
                </>
              )}
            </p>

            <button
              type="button"
              onClick={e => openReflection(index, e)}
              className="text-left w-full group cursor-pointer mt-3"
              aria-label={`Read ${reflection.studentName}'s reflection`}
            >
              <span className="block text-[10px] text-gray-300 uppercase tracking-wide">
                {reflection.weekLabel}
              </span>
              {reflection.text && (
                <span className="block text-sm text-gray-700 whitespace-pre-line leading-relaxed line-clamp-4 mt-1">
                  {reflection.text}
                </span>
              )}
              {reflection.fileUrl && (
                <span className="block text-xs text-gray-400 mt-2">
                  📎 {reflection.isImage ? 'Journal photo' : reflection.fileName ?? 'Uploaded file'}
                </span>
              )}
              <span className="inline-block mt-1 text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                Read more
              </span>
            </button>
          </div>
        ))}

        {visible.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">
            {isFiltered ? 'No reflections match these filters.' : 'No reflections submitted yet.'}
          </p>
        )}
      </div>

      {openIndex >= 0 && (
        <ReflectionDrawer
          reflections={visible}
          index={openIndex}
          onClose={closeDrawer}
          onNavigate={i => setOpenKey(visible[i]?.key ?? null)}
        />
      )}
    </>
  )
}
