'use client'

import { useState, useTransition } from 'react'
import { inviteStudent, createStudentAccount } from '@/app/actions/admin'

export default function InviteStudentForm() {
  const [open, setOpen] = useState(false)
  const [sendInvite, setSendInvite] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    startTransition(async () => {
      const result = sendInvite
        ? await inviteStudent(formData)
        : await createStudentAccount(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSuccess(sendInvite
        ? `Invite sent to ${email}`
        : `Account created for ${email} — no email sent. They can sign in via "Forgot password?" using that address.`)
      ;(e.target as HTMLFormElement).reset()
    })
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-xl px-4 py-3 w-full hover:border-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Add student
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-900">Add student</h3>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
        <input name="fullName" required placeholder="Jane Smith" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
        <input name="email" type="email" required placeholder="jane@example.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>

      <div className="space-y-1.5 pt-1">
        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="radio" name="mode" checked={sendInvite} onChange={() => setSendInvite(true)} className="mt-1" />
          <span>
            Send an invite email
            <span className="block text-xs text-gray-400">They set their password from the emailed link.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="radio" name="mode" checked={!sendInvite} onChange={() => setSendInvite(false)} className="mt-1" />
          <span>
            Create account only — no email (transfer)
            <span className="block text-xs text-gray-400">
              For students moving from another system. Skips the application entirely; they sign in
              later via &ldquo;Forgot password?&rdquo; with this same email.
            </span>
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={isPending} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
          {isPending ? 'Working…' : sendInvite ? 'Send invite' : 'Create account'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
      </div>
    </form>
  )
}
