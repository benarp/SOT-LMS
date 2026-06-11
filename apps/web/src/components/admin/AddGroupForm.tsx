'use client'

import { useState, useTransition } from 'react'
import { addGroup } from '@/app/actions/admin'

export default function AddGroupForm({ schoolYearId }: { schoolYearId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await addGroup(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      ;(e.target as HTMLFormElement).reset()
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-xl px-4 py-3 w-full hover:border-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Add group
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-900">Add group</h3>
      <input type="hidden" name="schoolYearId" value={schoolYearId} />
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Group name</label>
        <input name="name" required placeholder="Group A" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={isPending} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
          {isPending ? 'Adding…' : 'Add group'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
      </div>
    </form>
  )
}
