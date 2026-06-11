'use client'

import { useState } from 'react'
import { sendWeeklyEmail } from '@/app/actions/email'

export default function SendWeeklyEmailButton({
  lastSentAt,
  lastRecipientCount,
}: {
  lastSentAt?: string | null
  lastRecipientCount?: number | null
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ sent?: number; weekTitle?: string; error?: string }>({})

  const recentlySent =
    !!lastSentAt && Date.now() - new Date(lastSentAt).getTime() < 5 * 24 * 60 * 60 * 1000

  async function handleSend() {
    if (state === 'sending') return
    const warning = recentlySent
      ? `The weekly email already went out ${new Date(lastSentAt!).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}${lastRecipientCount ? ` to ${lastRecipientCount} students` : ''}. Send it again to everyone?`
      : 'Send the weekly email to all enrolled students?'
    if (!confirm(warning)) return
    setState('sending')
    const r = await sendWeeklyEmail()
    setResult(r)
    setState(r.error ? 'error' : 'done')
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={state === 'sending'}
        className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send weekly email
          </>
        )}
      </button>

      {state === 'done' && (
        <p className="mt-2 text-sm text-green-600 font-medium">
          Sent to {result.sent} student{result.sent !== 1 ? 's' : ''}{result.weekTitle ? ` — ${result.weekTitle}` : ''} ✓
        </p>
      )}

      {state === 'error' && (
        <p className="mt-2 text-sm text-red-500">
          {result.error}
        </p>
      )}

      {state === 'idle' && lastSentAt && (
        <p className="mt-2 text-xs text-gray-400">
          Last sent {new Date(lastSentAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          {lastRecipientCount ? ` · ${lastRecipientCount} recipients` : ''}
        </p>
      )}
    </div>
  )
}
