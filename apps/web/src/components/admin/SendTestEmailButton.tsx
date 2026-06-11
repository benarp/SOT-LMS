'use client'

import { useState } from 'react'
import { sendTestEmail } from '@/app/actions/email'

export default function SendTestEmailButton() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ weekTitle?: string; error?: string }>({})

  async function handleSend() {
    if (state === 'sending') return
    setState('sending')
    const r = await sendTestEmail()
    setResult(r)
    setState(r.error ? 'error' : 'done')
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={state === 'sending'}
        className="inline-flex items-center gap-2 bg-white text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {state === 'sending' ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Sending…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Send test to me
          </>
        )}
      </button>

      {state === 'done' && (
        <p className="mt-2 text-sm text-green-600 font-medium">
          Test email sent to barp@allpeopleschurch.org ✓
        </p>
      )}
      {state === 'error' && (
        <p className="mt-2 text-sm text-red-500">{result.error}</p>
      )}
    </div>
  )
}
