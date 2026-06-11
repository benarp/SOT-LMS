'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveApplication, denyApplication } from '@/app/actions/apply'

export default function DecisionButtons({
  applicationId,
  applicantName,
}: {
  applicationId: string
  applicantName: string
}) {
  const [mode, setMode] = useState<'idle' | 'approving' | 'denying'>('idle')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDecision(decision: 'approve' | 'deny') {
    setLoading(true)
    setError('')
    const fn = decision === 'approve' ? approveApplication : denyApplication
    const result = await fn(applicationId, notes || undefined)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  if (mode === 'idle') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Make a decision</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setMode('approving')}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
          >
            Accept applicant
          </button>
          <button
            onClick={() => setMode('denying')}
            className="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  const isApproving = mode === 'approving'

  return (
    <div className={`bg-white border rounded-xl px-6 py-5 ${isApproving ? 'border-green-200' : 'border-red-200'}`}>
      <h2 className="text-sm font-semibold text-gray-900 mb-1">
        {isApproving ? `Accept ${applicantName}?` : `Decline ${applicantName}?`}
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        {isApproving
          ? 'Their account will be upgraded to student and they\'ll receive an acceptance email.'
          : 'They\'ll receive a decline email.'}
      </p>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Optional note to include in the email
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          placeholder="E.g. We'll reach out with more details soon."
        />
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => handleDecision(isApproving ? 'approve' : 'deny')}
          disabled={loading}
          className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
            isApproving
              ? 'bg-gray-900 text-white hover:bg-gray-700'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {loading
            ? 'Saving…'
            : isApproving ? 'Confirm acceptance' : 'Confirm decline'}
        </button>
        <button
          onClick={() => { setMode('idle'); setNotes(''); setError('') }}
          disabled={loading}
          className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
