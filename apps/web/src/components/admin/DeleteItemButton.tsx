'use client'

import { useTransition } from 'react'
import { deleteHomeworkItem } from '@/app/actions/admin'
import { useParams } from 'next/navigation'

export default function DeleteItemButton({ itemId }: { itemId: string }) {
  const [isPending, startTransition] = useTransition()
  const params = useParams()
  const weekId = params.weekId as string

  function handleDelete() {
    if (!confirm('Remove this homework item?')) return
    startTransition(() => deleteHomeworkItem(itemId, weekId))
  }

  return (
    <button onClick={handleDelete} disabled={isPending} className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50 p-1" aria-label="Delete item">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}
