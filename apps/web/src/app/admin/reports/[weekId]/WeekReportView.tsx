'use client'

import { useRef, useState } from 'react'
import ReflectionDrawer, { type Reflection } from '@/components/admin/ReflectionDrawer'

export type { Reflection }

export type Column = {
  id: string
  type: string
  title: string
  typeLabel: string
}

export type Cell =
  | { itemId: string; state: 'na' }
  | { itemId: string; state: 'missing' }
  | { itemId: string; state: 'done'; isLate: boolean }
  | {
      itemId: string
      state: 'reflection'
      reflectionIndex: number
      text: string | null
      isLate: boolean
      fileUrl: string | null
      fileName: string | null
      isImage: boolean
    }

export type Row = {
  id: string
  name: string
  planLabel: string
  cells: Cell[]
}

type Props = {
  columns: Column[]
  rows: Row[]
  reflections: Reflection[]
}

// Whether a reflection needs the drawer to be read in full. Deterministic on
// purpose — measuring the clamped element would mean a layout pass per cell.
function needsExpanding(text: string | null, fileUrl: string | null): boolean {
  if (fileUrl) return true
  if (!text) return false
  return text.length > 160 || text.split('\n').length > 3
}

export default function WeekReportView({ columns, rows, reflections }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const lastTrigger = useRef<HTMLElement | null>(null)

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
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3 sticky left-0 bg-white whitespace-nowrap">Student</th>
              {columns.map(column => (
                <th
                  key={column.id}
                  className={`text-left text-xs font-medium text-gray-400 px-4 py-3 align-bottom ${
                    column.type === 'reflection' ? 'min-w-[280px] max-w-[320px]' : 'min-w-[220px]'
                  }`}
                >
                  <span className="block text-[10px] text-gray-300 uppercase tracking-wide mb-0.5">{column.typeLabel}</span>
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className={i < rows.length - 1 ? 'border-b border-gray-50' : ''}>
                <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white whitespace-nowrap">
                  {row.name}
                  <span className="block text-[10px] font-normal text-gray-400">{row.planLabel}</span>
                </td>
                {row.cells.map((cell, c) => {
                  const column = columns[c]
                  if (cell.state === 'na') {
                    return (
                      <td key={cell.itemId} className="px-4 py-3 align-top bg-gray-50">
                        <span className="text-xs text-gray-300">n/a — other plan</span>
                      </td>
                    )
                  }
                  if (cell.state === 'missing') {
                    return (
                      <td key={cell.itemId} className="px-4 py-3 align-top">
                        <span className="text-sm text-red-500">
                          {column.type === 'reflection' ? 'Not submitted' : 'Not done'}
                        </span>
                      </td>
                    )
                  }
                  if (cell.state === 'done') {
                    return (
                      <td key={cell.itemId} className="px-4 py-3 align-top">
                        <span className="text-sm text-green-600 font-medium">
                          Done{cell.isLate ? ' (late)' : ''}
                        </span>
                      </td>
                    )
                  }
                  const expandable = needsExpanding(cell.text, cell.fileUrl)
                  return (
                    <td key={cell.itemId} className="px-4 py-3 align-top max-w-[320px]">
                      <button
                        type="button"
                        onClick={e => openReflection(cell.reflectionIndex, e)}
                        className="text-left w-full group cursor-pointer"
                        aria-label={`Read ${row.name}'s reflection`}
                      >
                        <span className="block text-xs font-medium text-green-600 mb-1">
                          Submitted{cell.isLate ? ' (late)' : ''}
                        </span>
                        {cell.text && (
                          <span className="block text-sm text-gray-700 whitespace-pre-line line-clamp-3">{cell.text}</span>
                        )}
                        {cell.fileUrl && cell.isImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cell.fileUrl}
                            alt=""
                            className="mt-1.5 w-10 h-10 rounded object-cover border border-gray-200"
                          />
                        )}
                        {cell.fileUrl && !cell.isImage && (
                          <span className="block mt-1.5 text-xs text-gray-400 truncate">
                            📎 {cell.fileName ?? 'Uploaded file'}
                          </span>
                        )}
                        {expandable && (
                          <span className="inline-block mt-1 text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                            Read more
                          </span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-400 text-sm">No students enrolled yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openIndex !== null && reflections[openIndex] && (
        <ReflectionDrawer
          reflections={reflections}
          index={openIndex}
          onClose={closeDrawer}
          onNavigate={setOpenIndex}
        />
      )}
    </>
  )
}
