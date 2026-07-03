'use client'

import { useState, useTransition } from 'react'
import { startCheckout, openCardUpdatePortal } from '@/app/actions/billing'

export function StartCheckoutButton() {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  return (
    <div>
      <button
        onClick={() => startTransition(async () => {
          const result = await startCheckout()
          if (result?.error) setError(result.error)
        })}
        disabled={pending}
        className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {pending ? 'Redirecting…' : 'Set up payment →'}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}

export function UpdateCardButton() {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  return (
    <div>
      <button
        onClick={() => startTransition(async () => {
          const result = await openCardUpdatePortal()
          if (result?.error) setError(result.error)
        })}
        disabled={pending}
        className="text-sm text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-50"
      >
        {pending ? 'Opening…' : 'Update card on file'}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}
