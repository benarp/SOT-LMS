'use client'

import { useState, useTransition } from 'react'
import { startApplicantCheckout } from '@/app/actions/billing'

export default function TuitionSetupCard({ depositPaid }: { depositPaid: boolean }) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  if (depositPaid) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tuition</h3>
        <p className="text-sm text-green-700 bg-green-50 rounded-xl p-4">
          ✓ Deposit received — you&apos;re all set. Your monthly payments start about a month
          after your deposit, and you&apos;ll get full access to the student portal when the
          school year begins.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tuition</h3>
      <p className="text-sm text-gray-600 mb-1">
        Secure your spot by setting up tuition: a <strong>$400 deposit</strong> today, then
        $200/month for 10 months — $2,400 total.
      </p>
      <p className="text-xs text-gray-400 mb-4">Payments are processed securely by Stripe.</p>
      <button
        onClick={() => startTransition(async () => {
          const result = await startApplicantCheckout()
          if (result?.error) setError(result.error)
        })}
        disabled={pending}
        className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {pending ? 'Redirecting…' : 'Set up tuition payment →'}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}
