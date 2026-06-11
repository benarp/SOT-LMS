'use client'

import { useState, useTransition } from 'react'
import { setUserActive, sendPasswordSetupEmail } from '@/app/actions/admin'

export default function AccountActions({
  userId,
  isDeactivated,
  hasSignedIn,
}: {
  userId: string
  isDeactivated: boolean
  hasSignedIn: boolean
}) {
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleToggleActive() {
    const msg = isDeactivated
      ? 'Reactivate this account? They will be able to sign in again.'
      : 'Deactivate this account? They will no longer be able to sign in. Their data is kept.'
    if (!confirm(msg)) return
    setError('')
    setNotice('')
    startTransition(async () => {
      const result = await setUserActive(userId, isDeactivated)
      if (result.error) setError(result.error)
    })
  }

  function handleSendPasswordEmail() {
    setError('')
    setNotice('')
    startTransition(async () => {
      const result = await sendPasswordSetupEmail(userId)
      if (result.error) setError(result.error)
      else setNotice('Password email sent.')
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm text-gray-700">{hasSignedIn ? 'Reset password' : 'Set up password'}</p>
          <p className="text-xs text-gray-400">
            {hasSignedIn
              ? 'Emails them a link to choose a new password.'
              : "They haven't signed in yet — emails a link to set their password."}
          </p>
        </div>
        <button
          onClick={handleSendPasswordEmail}
          disabled={isPending}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50 shrink-0"
        >
          Send email
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <div>
          <p className="text-sm text-gray-700">{isDeactivated ? 'Reactivate account' : 'Deactivate account'}</p>
          <p className="text-xs text-gray-400">
            {isDeactivated
              ? 'Restores their ability to sign in.'
              : 'Blocks sign-in without deleting any data.'}
          </p>
        </div>
        <button
          onClick={handleToggleActive}
          disabled={isPending}
          className={`text-xs border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 shrink-0 ${
            isDeactivated
              ? 'border-gray-200 hover:bg-gray-50'
              : 'border-red-200 text-red-600 hover:bg-red-50'
          }`}
        >
          {isDeactivated ? 'Reactivate' : 'Deactivate'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-600">{notice}</p>}
    </div>
  )
}
