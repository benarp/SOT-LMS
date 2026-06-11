'use client'

import { useState, useTransition } from 'react'
import { createAnnouncement } from '@/app/actions/admin'

export default function CreateAnnouncementForm() {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await createAnnouncement(formData)
        setSuccess('Announcement published.')
        ;(e.target as HTMLFormElement).reset()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-medium text-gray-900">New announcement</h2>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
        <input name="title" required placeholder="Important update" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
        <textarea name="body" required rows={3} placeholder="Write your announcement here…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <button type="submit" disabled={isPending} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
        {isPending ? 'Publishing…' : 'Publish announcement'}
      </button>
    </form>
  )
}
