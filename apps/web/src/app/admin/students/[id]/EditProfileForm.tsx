'use client'

import { useState, useTransition } from 'react'
import { updateUserProfile } from '@/app/actions/admin'

export default function EditProfileForm({
  userId,
  initialName,
  initialEmail,
  initialBirthday,
}: {
  userId: string
  initialName: string
  initialEmail: string
  initialBirthday: string | null
}) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [birthday, setBirthday] = useState(initialBirthday ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const dirty = name !== initialName || email !== initialEmail || birthday !== (initialBirthday ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    startTransition(async () => {
      const result = await updateUserProfile(userId, name.trim(), email.trim(), birthday || null)
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div>
        <label htmlFor="full-name" className="block text-xs font-medium text-gray-500 mb-1">Full name</label>
        <input
          id="full-name"
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setSaved(false) }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
      </div>
      <div>
        <label htmlFor="profile-email" className="block text-xs font-medium text-gray-500 mb-1">Email</label>
        <input
          id="profile-email"
          type="email"
          required
          value={email}
          onChange={e => { setEmail(e.target.value); setSaved(false) }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        {email !== initialEmail && (
          <p className="text-xs text-amber-600 mt-1">Changing the email also changes how they sign in.</p>
        )}
      </div>
      <div>
        <label htmlFor="profile-birthday" className="block text-xs font-medium text-gray-500 mb-1">Birthday <span className="text-gray-400">(optional)</span></label>
        <input
          id="profile-birthday"
          type="date"
          value={birthday}
          onChange={e => { setBirthday(e.target.value); setSaved(false) }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}
      <button
        type="submit"
        disabled={isPending || !dirty}
        className="bg-gray-900 text-white py-1.5 px-4 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
      >
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
