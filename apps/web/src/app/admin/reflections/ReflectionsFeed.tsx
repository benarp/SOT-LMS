'use client'

import { useMemo, useRef, useState } from 'react'
import ReflectionDrawer, { type Reflection } from '@/components/admin/ReflectionDrawer'

export type WeekOption = {
  id: string
  label: string
}

type FeedReflection = Reflection & { weekId: string }

type Props = {
  reflections: FeedReflection[]
  weeks: WeekOption[]
}

export default function ReflectionsFeed({ reflections, weeks }: Props) {
  const [weekId, setWeekId] = useState('all')
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const lastTrigger = useRef<HTMLElement | null>(null)

  // The list arrives newest-first, so filtering preserves the order.
  const visible = useMemo(
    () => (weekId === 'all' ? reflections : reflections.filter(r => r.weekId === weekId)),
    [reflections, weekId]
  )

  function chooseWeek(next: string) {
    setWeekId(next)
    // Drawer indexes into the filtered list, so an open one would point at the
    // wrong reflection once the filter changes.
    setOpenIndex(null)
  }

  function openReflection(index: number, event: React.MouseEvent<HTMLElement>) {
    lastTrigger.current = event.currentTarget
    setOpenIndex(index)
  }

  function closeDrawer() {
    setOpenIndex(null)
    lastTrigger.current?.focus()
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <select
          value={weekId}
          onChange={e => chooseWeek(e.target.value)}
          aria-label="Filter by week"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          <option value="all">All weeks</option>
          {weeks.map(week => (
            <option key={week.id} value={week.id}>{week.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400">
          {visible.length} {visible.length === 1 ? 'reflection' : 'reflections'}
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
            {weekId === 'all' ? 'No reflections submitted yet.' : 'No reflections for this week.'}
          </p>
        )}
      </div>

      {openIndex !== null && visible[openIndex] && (
        <ReflectionDrawer
          reflections={visible}
          index={openIndex}
          onClose={closeDrawer}
          onNavigate={setOpenIndex}
        />
      )}
    </>
  )
}
