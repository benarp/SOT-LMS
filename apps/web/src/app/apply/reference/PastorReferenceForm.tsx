'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { savePastorInfo } from '@/app/actions/apply'

type ExistingRef = {
  pastor_name: string | null
  pastor_email: string | null
  pastor_church: string | null
  status: string
} | null

export default function PastorReferenceForm({
  existingRef,
  applicationStatus,
}: {
  existingRef: ExistingRef
  applicationStatus: string
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const alreadySent = existingRef && (existingRef.status === 'sent' || existingRef.status === 'submitted')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    const result = await savePastorInfo(formData)
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push('/apply/status')
    }
  }

  if (alreadySent) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        {existingRef?.status === 'submitted' ? (
          <>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Reference received</h3>
            <p className="text-sm text-gray-500">
              {existingRef.pastor_name} has completed your reference. Your application is under review.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Reference request sent</h3>
            <p className="text-sm text-gray-500 mb-1">
              We sent a reference request to <strong>{existingRef?.pastor_email}</strong>.
            </p>
            <p className="text-sm text-gray-400">
              Once {existingRef?.pastor_name} completes it, this step will be marked complete.
            </p>
          </>
        )}

        <button
          onClick={() => router.push('/apply/status')}
          className="mt-6 text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700"
        >
          View application status
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1 uppercase tracking-wide">Pastoral reference</h3>
        <p className="text-sm text-gray-500 mb-6">
          We'll email your pastor a short reference form. This is the final step — once you submit,
          your application will be sent for review.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pastor's name</label>
            <input
              name="pastor_name"
              type="text"
              required
              defaultValue={existingRef?.pastor_name ?? ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Pastor John Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pastor's email</label>
            <input
              name="pastor_email"
              type="email"
              required
              defaultValue={existingRef?.pastor_email ?? ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="pastor@church.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Church name</label>
            <input
              name="pastor_church"
              type="text"
              required
              defaultValue={existingRef?.pastor_church ?? ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Grace Community Church"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {saving ? 'Sending reference request…' : 'Submit application & send reference →'}
      </button>
    </form>
  )
}
