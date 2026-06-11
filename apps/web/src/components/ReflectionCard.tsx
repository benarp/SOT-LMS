'use client'

import { useState, useTransition } from 'react'
import { submitReflection } from '@/app/actions/reflections'

type Book = {
  id: string
  title: string
  author: string | null
  sort_order: number
}

type Submission = {
  book_id: string
  content: string | null
  file_url: string | null
  submitted_at: string
}

export default function ReflectionCard({
  book,
  submission,
}: {
  book: Book
  submission: Submission | null
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const submitted = !!submission

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    formData.set('bookId', book.id)

    const content = formData.get('content') as string
    const file = formData.get('file') as File

    if (!content.trim() && (!file || file.size === 0)) {
      setError('Please write a reflection or upload a file.')
      return
    }

    startTransition(async () => {
      try {
        await submitReflection(formData)
        setOpen(false)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${submitted ? 'border-gray-100' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-start gap-4 px-4 py-4">
        <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          submitted ? 'bg-gray-900 border-gray-900' : 'border-gray-300'
        }`}>
          {submitted && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{book.title}</p>
          {book.author && <p className="text-xs text-gray-400 mt-0.5">{book.author}</p>}
          {submitted && (
            <p className="text-xs text-green-600 mt-1">
              Submitted {new Date(submission!.submitted_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
              })}
            </p>
          )}
        </div>

        {!submitted && (
          <button
            onClick={() => setOpen(o => !o)}
            className="flex-shrink-0 text-sm text-gray-500 hover:text-gray-900 transition-colors px-3 py-1 border border-gray-200 rounded-lg hover:border-gray-300"
          >
            {open ? 'Cancel' : 'Write reflection'}
          </button>
        )}
      </div>

      {/* Submission form */}
      {open && !submitted && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 px-4 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your reflection
            </label>
            <textarea
              name="content"
              rows={6}
              placeholder="Write your reflection here…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Or upload a file
            </label>
            <input
              type="file"
              name="file"
              accept=".pdf,.doc,.docx,.txt"
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-sm file:text-gray-700 file:bg-white hover:file:border-gray-300 file:cursor-pointer"
            />
            <p className="text-xs text-gray-400 mt-1">PDF, Word, or text file</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Submitting…' : 'Submit reflection'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors px-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Submitted content preview */}
      {submitted && submission?.content && (
        <div className="border-t border-gray-50 px-4 py-3">
          <p className="text-sm text-gray-500 line-clamp-3">{submission.content}</p>
        </div>
      )}
      {submitted && submission?.file_url && !submission?.content && (
        <div className="border-t border-gray-50 px-4 py-3">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            File uploaded
          </p>
        </div>
      )}
    </div>
  )
}
