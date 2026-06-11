'use client'

import { useState, useTransition } from 'react'
import { startImpersonation } from '@/app/actions/impersonate'

export default function ImpersonateButton({ email, name }: { email: string; name: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleImpersonate(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`View the site as ${name}? You'll be returned to the admin panel when you exit.`)) return
    setError('')
    startTransition(async () => {
      const result = await startImpersonation(email, name)
      if (result.error) {
        setError(result.error)
        return
      }
      // Full reload — the action swapped the session cookies to the student,
      // which applies browser-wide, so a second tab would be misleading.
      window.location.href = '/dashboard'
    })
  }

  return (
    <div>
      <button
        onClick={handleImpersonate}
        disabled={isPending}
        className="text-xs text-gray-400 hover:text-gray-700 transition-colors border border-gray-200 rounded-lg px-2 py-1 hover:border-gray-300 disabled:opacity-50"
      >
        {isPending ? 'Opening…' : 'View as student'}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
