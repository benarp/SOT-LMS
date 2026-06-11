'use client'

import { useState, useTransition } from 'react'
import { generateImpersonationLink } from '@/app/actions/impersonate'

export default function ImpersonateButton({ email, name }: { email: string; name: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleImpersonate() {
    if (!confirm(`Open a new tab signed in as ${name}?`)) return
    setError('')
    startTransition(async () => {
      try {
        const link = await generateImpersonationLink(email)
        window.open(link, '_blank')
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to generate link.')
      }
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
