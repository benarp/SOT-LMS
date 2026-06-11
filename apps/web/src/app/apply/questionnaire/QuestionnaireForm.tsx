'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveQuestionnaire } from '@/app/actions/apply'

type Settings = {
  q_testimony_label: string; q_testimony_hint: string
  q_why_attend_label: string; q_why_attend_hint: string
  q_goals_label: string; q_goals_hint: string
  q_serving_label: string; q_serving_hint: string
  q_additional_label: string; q_additional_hint: string
  agreement_text: string
} | null

const DEFAULTS: NonNullable<Settings> = {
  q_testimony_label: 'Share your testimony',
  q_testimony_hint: 'How did you come to faith, and what has your journey with Jesus looked like?',
  q_why_attend_label: 'Why do you want to attend the School of Transformation this year?',
  q_why_attend_hint: '',
  q_goals_label: 'What are you hoping God will do in your life through this program?',
  q_goals_hint: '',
  q_serving_label: 'Are you currently involved in a local church?',
  q_serving_hint: "If so, describe how you're serving.",
  q_additional_label: "Is there anything else you'd like us to know?",
  q_additional_hint: 'Optional.',
  agreement_text:
    'I understand that School of Transformation is a 9-month commitment running September through May. I agree to attend weekly sessions and complete assignments to the best of my ability. I understand there is a cost associated with the program.',
}

type Props = {
  existing: Record<string, string | boolean | null> | null
  settings: Settings
  schoolYearName: string
}

export default function QuestionnaireForm({ existing, settings, schoolYearName }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const q = { ...DEFAULTS, ...(settings || {}) }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const result = await saveQuestionnaire(new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push('/apply/reference')
    }
  }

  const val = (key: string) => (existing?.[key] as string) ?? ''

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Personal information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input name="full_name" type="text" required defaultValue={val('full_name')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input name="phone" type="tel" defaultValue={val('phone')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input name="city" type="text" defaultValue={val('city')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
        </div>
      </div>

      {/* Essay questions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">About you</h3>
        <Essay name="q_testimony" required label={q.q_testimony_label} hint={q.q_testimony_hint} defaultValue={val('q_testimony')} />
        <Essay name="q_why_attend" required label={q.q_why_attend_label} hint={q.q_why_attend_hint} defaultValue={val('q_why_attend')} />
        <Essay name="q_goals" required label={q.q_goals_label} hint={q.q_goals_hint} defaultValue={val('q_goals')} />
        <Essay name="q_serving" required label={q.q_serving_label} hint={q.q_serving_hint} defaultValue={val('q_serving')} />
        <Essay name="q_additional" label={q.q_additional_label} hint={q.q_additional_hint} defaultValue={val('q_additional')} />
      </div>

      {/* Agreement */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Agreement</h3>
        <p className="text-sm text-gray-600 mb-4">{q.agreement_text}</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="agreement"
            required
            defaultChecked={!!existing?.agreement_accepted}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          <span className="text-sm text-gray-700">I agree to the above</span>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save & continue to Step 2 →'}
      </button>
    </form>
  )
}

function Essay({ name, label, hint, required, defaultValue }: {
  name: string; label: string; hint?: string; required?: boolean; defaultValue?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <textarea
        name={name}
        required={required}
        defaultValue={defaultValue}
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y"
      />
    </div>
  )
}
