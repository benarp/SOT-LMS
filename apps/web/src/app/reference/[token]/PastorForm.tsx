'use client'

import { useState } from 'react'
import { submitPastoralReference } from '@/app/actions/apply'

export default function PastorForm({
  token,
  pastorName,
  applicantName,
}: {
  token: string
  pastorName: string
  applicantName: string
}) {
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const result = await submitPastoralReference(token, {
      ref_relationship: fd.get('ref_relationship') as string,
      ref_character: fd.get('ref_character') as string,
      ref_recommend: fd.get('ref_recommend') as string,
      ref_concerns: fd.get('ref_concerns') as string,
    })
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Thank you, {pastorName}!</h2>
        <p className="text-sm text-gray-500">
          We've received your reference for {applicantName}. We really appreciate your time.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
        <Textarea
          name="ref_relationship"
          label={`How long have you known ${applicantName}, and in what capacity?`}
          required
        />
        <Textarea
          name="ref_character"
          label="Describe their character and maturity in their faith."
          required
        />
        <Textarea
          name="ref_recommend"
          label="Do you recommend this person for the School of Transformation? Why or why not?"
          required
        />
        <Textarea
          name="ref_concerns"
          label="Are there any areas of concern you'd want us to be aware of?"
          hint="Optional."
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {saving ? 'Submitting…' : 'Submit reference'}
      </button>
    </form>
  )
}

function Textarea({ name, label, hint, required }: { name: string; label: string; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <textarea
        name={name}
        required={required}
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y"
      />
    </div>
  )
}
