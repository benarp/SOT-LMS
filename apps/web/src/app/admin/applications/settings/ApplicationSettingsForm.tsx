'use client'

import { useState } from 'react'
import { updateApplicationSettings } from '@/app/actions/apply'

type Values = {
  q_testimony_label: string; q_testimony_hint: string
  q_why_attend_label: string; q_why_attend_hint: string
  q_goals_label: string; q_goals_hint: string
  q_serving_label: string; q_serving_hint: string
  q_additional_label: string; q_additional_hint: string
  agreement_text: string
}

export default function ApplicationSettingsForm({ values }: { values: Values }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    const result = await updateApplicationSettings(new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-xs text-gray-400">
        Each question has a <strong>label</strong> (the question itself) and an optional <strong>hint</strong> (smaller gray text shown below it).
      </p>

      {/* Essay questions */}
      {[
        { key: 'q_testimony', number: 1 },
        { key: 'q_why_attend', number: 2 },
        { key: 'q_goals', number: 3 },
        { key: 'q_serving', number: 4 },
        { key: 'q_additional', number: 5 },
      ].map(({ key, number }) => (
        <div key={key} className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Question {number}</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input
                name={`${key}_label`}
                type="text"
                required
                defaultValue={values[`${key}_label` as keyof Values]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hint <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                name={`${key}_hint`}
                type="text"
                defaultValue={values[`${key}_hint` as keyof Values]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Leave blank for no hint"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Agreement */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Agreement text</p>
        <textarea
          name="agreement_text"
          required
          defaultValue={values.agreement_text}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save questions'}
        </button>
        {saved && <p className="text-sm text-green-600 font-medium">Saved ✓</p>}
      </div>
    </form>
  )
}
