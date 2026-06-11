'use client'

import { useState, useTransition } from 'react'
import { inviteStudent } from '@/app/actions/admin'

export default function InviteStudentForm() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await inviteStudent(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSuccess(`Invite sent to ${formData.get('email')}`)
      ;(e.target as HTMLFormElement).reset()
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-xl px-4 py-3 w-full hover:border-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Invite student
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-900">Invite student</h3>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
        <input name="fullName" required placeholder="Jane Smith" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
        <input name="email" type="email" required placeholder="jane@example.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={isPending} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
          {isPending ? 'Sending…' : 'Send invite'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
      </div>
    </form>
  )
}
