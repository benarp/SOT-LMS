'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reorderHomeworkItems } from '@/app/actions/admin'
import DeleteItemButton from '@/components/admin/DeleteItemButton'
import EditItemButton from '@/components/admin/EditItemButton'
import { BIBLE_PLAN_LABELS, asBiblePlan } from '@/lib/biblePlan'

const typeLabels: Record<string, string> = {
  bible_reading: 'Scripture Reading',
  book_reading: 'Book Reading',
  video: 'Video',
  reflection: 'Reflection',
}

type Item = {
  id: string
  type: string
  title: string
  description: string | null
  external_url: string | null
  content: string | null
  sort_order: number
  show_attribution: boolean
  bible_plan: string | null
}

export default function HomeworkItemList({ items: serverItems, weekId }: { items: Item[]; weekId: string }) {
  // Local copy so drag reorders render instantly; server refresh re-syncs it.
  // Adjusted during render (not an effect) when serverItems changes identity.
  const [items, setItems] = useState(serverItems)
  const [syncedServerItems, setSyncedServerItems] = useState(serverItems)
  if (serverItems !== syncedServerItems) {
    setSyncedServerItems(serverItems)
    setItems(serverItems)
  }
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  // Cards are only draggable while their grip is pressed, so text in the
  // inline edit form stays selectable.
  const [armedId, setArmedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()
  const router = useRouter()

  function handleDragEnter(overIndex: number) {
    if (dragIndex === null || dragIndex === overIndex) return
    setItems(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(overIndex, 0, moved)
      return next
    })
    setDragIndex(overIndex)
  }

  function handleDragEnd() {
    setArmedId(null)
    if (dragIndex === null) return
    setDragIndex(null)
    setError('')
    const orderedIds = items.map(i => i.id)
    startTransition(async () => {
      const result = await reorderHomeworkItems(weekId, orderedIds)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {items.map((item, i) => (
        <div
          key={item.id}
          draggable={armedId === item.id}
          onDragStart={e => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move' }}
          onDragEnter={() => handleDragEnter(i)}
          onDragOver={e => e.preventDefault()}
          onDragEnd={handleDragEnd}
          className={`bg-white border rounded-xl pl-2 pr-4 py-3.5 transition-shadow ${
            dragIndex === i ? 'opacity-60 shadow-lg border-gray-400' : 'border-gray-200'
          }`}
        >
          <div className="flex items-start gap-2">
            <span
              onMouseDown={() => setArmedId(item.id)}
              onMouseUp={() => setArmedId(null)}
              className="flex-shrink-0 mt-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing select-none px-1"
              title="Drag to reorder"
              aria-hidden
            >
              ⠿
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">
                {typeLabels[item.type]}
                {item.bible_plan && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                    {BIBLE_PLAN_LABELS[asBiblePlan(item.bible_plan)]} only
                  </span>
                )}
              </p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{item.title}</p>
              {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
              {item.external_url && (
                <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 mt-0.5 block truncate">{item.external_url}</a>
              )}
              {item.content && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 font-mono">{item.content}</p>
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <EditItemButton item={item} />
              <DeleteItemButton itemId={item.id} />
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-gray-400 py-2">No items yet.</p>
      )}
    </div>
  )
}
