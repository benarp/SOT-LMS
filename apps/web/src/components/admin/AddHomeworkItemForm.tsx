'use client'

import { useState, useTransition } from 'react'
import { addHomeworkItem } from '@/app/actions/admin'

type Book = { id: string; title: string }

export default function AddHomeworkItemForm({ weekId, books, nextSortOrder }: { weekId: string, books: Book[], nextSortOrder: number }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('bible_reading')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await addHomeworkItem(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      setType('bible_reading')
      ;(e.target as HTMLFormElement).reset()
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-xl px-4 py-3 w-full hover:border-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Add homework item
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-medium text-gray-900">Add homework item</h3>
      <input type="hidden" name="weekId" value={weekId} />
      <input type="hidden" name="sortOrder" value={nextSortOrder} />

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
        <select name="type" value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
          <option value="bible_reading">Scripture Reading</option>
          <option value="book_reading">Book Reading</option>
          <option value="video">Video</option>
          <option value="reflection">Reflection</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
        <input name="title" required placeholder={
          type === 'bible_reading' ? 'Genesis 1–3'
          : type === 'book_reading' ? 'Spiritual Disciplines, ch. 1–2'
          : type === 'video' ? 'Bible Project: Genesis Overview'
          : 'Reflection question'
        } className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-gray-400">(optional)</span></label>
        <input name="description" placeholder="Additional context for students" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>

      {(type === 'bible_reading' || type === 'book_reading' || type === 'reflection') && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {type === 'reflection' ? 'Prompt' : 'Day-by-day reading'}
            <span className="text-gray-400 ml-1">(optional)</span>
          </label>
          <textarea
            name="content"
            rows={5}
            placeholder={type === 'reflection'
              ? 'The prompt or questions students respond to…'
              : type === 'bible_reading'
                ? 'Day 1: Genesis 1–2\nDay 2: Genesis 3–5\nDay 3: Genesis 6–9\n...'
                : 'Day 1: Chapter 1\nDay 2: Chapter 2\n...'
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y font-mono"
          />
        </div>
      )}

      {type === 'video' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Video URL</label>
          <input name="externalUrl" type="url" placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
      )}

      {type === 'reflection' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Book <span className="text-gray-400">(optional — links the reflection to a book)</span></label>
          <select name="bookId" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
            <option value="">No book — standalone reflection</option>
            {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={isPending} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
          {isPending ? 'Adding…' : 'Add item'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setType('bible_reading') }} className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
      </div>
    </form>
  )
}
