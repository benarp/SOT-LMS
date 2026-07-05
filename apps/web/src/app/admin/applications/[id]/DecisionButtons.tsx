'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveApplication, denyApplication, advancePastReference } from '@/app/actions/apply'

type Mode = 'idle' | 'approving' | 'denying' | 'waiving'

export default function DecisionButtons({
  applicationId,
  applicantName,
  status,
}: {
  applicationId: string
  applicantName: string
  status: string
}) {
  const [mode, setMode] = useState<Mode>('idle')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const inReference = status === 'reference_requested' || status === 'submitted'
  const inInterview = status === 'interview'

  async function run(fn: () => Promise<{ error?: string }>) {
    setLoading(true)
    setError('')
    const result = await fn()
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
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
          {inReference ? 'Awaiting reference' : 'Make a decision'}
        </h2>
        <div className="flex flex-wrap gap-3">
          {inReference && (
            <button
              onClick={() => setMode('waiving')}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
            >
              Move to interview without reference
            </button>
          )}
          {inInterview && (
            <button
              onClick={() => setMode('approving')}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
            >
              Accept applicant
            </button>
          )}
          <button
            onClick={() => setMode('denying')}
            className="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Decline
          </button>
        </div>
        {inReference && (
          <p className="text-xs text-gray-400 mt-3">
            The application moves to Interview automatically when the reference arrives.
            Advancing manually requires a note explaining why.
          </p>
        )}
      </div>
    )
  }

  const config = {
    approving: {
      border: 'border-green-200',
      title: `Accept ${applicantName}?`,
      blurb: "They'll receive an acceptance email with a link to set up tuition. They get portal access once their deposit is paid and the school year starts.",
      noteLabel: 'Optional note to include in the email',
      noteRequired: false,
      confirm: 'Confirm acceptance',
      confirmClasses: 'bg-gray-900 text-white hover:bg-gray-700',
      action: () => approveApplication(applicationId, notes || undefined),
    },
    denying: {
      border: 'border-red-200',
      title: `Decline ${applicantName}?`,
      blurb: "They'll receive a decline email.",
      noteLabel: 'Optional note to include in the email',
      noteRequired: false,
      confirm: 'Confirm decline',
      confirmClasses: 'bg-red-600 text-white hover:bg-red-700',
      action: () => denyApplication(applicationId, notes || undefined),
    },
    waiving: {
      border: 'border-amber-200',
      title: `Move ${applicantName} to interview?`,
      blurb: 'This skips the pastoral reference. The note is recorded on the application and in the audit log.',
      noteLabel: 'Why is the reference being skipped? (required)',
      noteRequired: true,
      confirm: 'Move to interview',
      confirmClasses: 'bg-gray-900 text-white hover:bg-gray-700',
      action: () => advancePastReference(applicationId, notes),
    },
  }[mode]

  return (
    <div className={`bg-white border rounded-xl px-6 py-5 ${config.border}`}>
      <h2 className="text-sm font-semibold text-gray-900 mb-1">{config.title}</h2>
      <p className="text-xs text-gray-400 mb-4">{config.blurb}</p>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">{config.noteLabel}</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          placeholder={mode === 'waiving' ? 'E.g. Known to staff — longtime church member, reference unnecessary.' : "E.g. We'll reach out with more details soon."}
        />
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => run(config.action)}
          disabled={loading || (config.noteRequired && !notes.trim())}
          className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${config.confirmClasses}`}
        >
          {loading ? 'Saving…' : config.confirm}
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
