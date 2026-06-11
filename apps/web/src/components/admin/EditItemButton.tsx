'use client'

import { useState, useTransition } from 'react'
import { useParams } from 'next/navigation'
import { updateHomeworkItem } from '@/app/actions/admin'

type Item = {
  id: string
  type: string
  title: string
  description: string | null
  external_url: string | null
  content: string | null
}

export default function EditItemButton({ item }: { item: Item }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const params = useParams()
  const weekId = params.weekId as string

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateHomeworkItem(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-gray-300 hover:text-gray-600 transition-colors p-1"
        aria-label="Edit item"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    )
  }

  const showContent = item.type === 'bible_reading' || item.type === 'written'
  const showUrl = item.type === 'video'

  return (
    <form onSubmit={handleSubmit} className="w-full mt-3 pt-3 border-t border-gray-100 space-y-3">
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="weekId" value={weekId} />

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
        <input
          name="title"
          defaultValue={item.title}
          required
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Description <span className="text-gray-400">(optional)</span></label>
        <input
          name="description"
          defaultValue={item.description ?? ''}
          placeholder="Additional context for students"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {showContent && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {item.type === 'bible_reading' ? 'Day-by-day reading' : 'Instructions'}
            <span className="text-gray-400 ml-1">(optional)</span>
          </label>
          <textarea
            name="content"
            defaultValue={item.content ?? ''}
            rows={5}
            placeholder={item.type === 'bible_reading' ? 'Day 1: Genesis 1–2\nDay 2: Genesis 3–5\n...' : 'Instructions for students…'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y font-mono"
          />
        </div>
      )}

      {showUrl && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Video URL</label>
          <input
            name="externalUrl"
            type="url"
            defaultValue={item.external_url ?? ''}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError('') }}
          className="text-xs text-gray-400 hover:text-gray-600 px-2"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
