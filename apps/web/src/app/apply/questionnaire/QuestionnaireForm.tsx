'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveAnswer, saveContactInfo, submitQuestionnaire } from '@/app/actions/applicationForm'
import {
  type AppField, type AnswerMap, groupIntoSteps, isVisible, missingRequired,
} from '@/lib/applicationForm'

type Contact = { full_name: string; phone: string; city: string }

const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent'

export default function QuestionnaireForm({
  fields, initialAnswers, contact: initialContact, schoolYearName, preview = false,
}: {
  fields: AppField[]
  initialAnswers: AnswerMap
  contact: Contact
  schoolYearName: string
  /** Admin preview: fully interactive (branching included) but never persists or submits. */
  preview?: boolean
}) {
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers)
  const [contact, setContact] = useState<Contact>(initialContact)
  const [stepIndex, setStepIndex] = useState(0)
  const [stepError, setStepError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const formSteps = useMemo(() => groupIntoSteps(fields), [fields])
  // Step 0 is the fixed contact step; authored steps follow
  const totalSteps = formSteps.length + 1
  const isContactStep = stepIndex === 0
  const currentStep = isContactStep ? null : formSteps[stepIndex - 1]
  const isLastStep = stepIndex === totalSteps - 1
  const progress = Math.round(((stepIndex + 1) / totalSteps) * 100)

  // Debounced autosave — answers persist as the applicant types
  function setAnswer(field: AppField, value: string | string[]) {
    setAnswers(prev => ({ ...prev, [field.id]: value }))
    if (preview) return
    clearTimeout(saveTimers.current[field.id])
    saveTimers.current[field.id] = setTimeout(() => {
      setSaving(true)
      saveAnswer(field.id, value).finally(() => setSaving(false))
    }, 600)
  }

  function flushContact() {
    const fd = new FormData()
    fd.set('full_name', contact.full_name)
    fd.set('phone', contact.phone)
    fd.set('city', contact.city)
    return saveContactInfo(fd)
  }

  function validateCurrentStep(): string {
    if (isContactStep) {
      if (!contact.full_name.trim() || !contact.phone.trim() || !contact.city.trim()) {
        return 'Please fill in your name, phone, and city.'
      }
      return ''
    }
    const missing = missingRequired(currentStep!.fields, answers)
    if (missing.length > 0) {
      return missing.length === 1
        ? `Please answer: ${missing[0].label.slice(0, 80)}`
        : `${missing.length} required questions still need an answer on this step.`
    }
    return ''
  }

  function goNext() {
    const error = validateCurrentStep()
    setStepError(error)
    if (error) return
    if (preview && isLastStep) {
      setStepError('End of preview — submitting is disabled here.')
      return
    }
    startTransition(async () => {
      if (isContactStep && !preview) {
        const result = await flushContact()
        if (result.error) { setStepError(result.error); return }
      }
      if (isLastStep) {
        const result = await submitQuestionnaire()
        if (result.error) { setStepError(result.error); return }
        router.push('/apply/reference')
        return
      }
      setStepIndex(i => i + 1)
      window.scrollTo({ top: 0 })
    })
  }

  function goBack() {
    setStepError('')
    setStepIndex(i => Math.max(0, i - 1))
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs text-gray-400">
            Step {stepIndex + 1} of {totalSteps}
            {' — '}
            <span className="text-gray-600 font-medium">{isContactStep ? 'Contact information' : currentStep!.title}</span>
          </p>
          <p className="text-xs text-gray-300">{preview ? 'Preview — nothing is saved' : saving ? 'Saving…' : 'Saved automatically'}</p>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gray-900 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-6">Applying for {schoolYearName}</p>

      {/* Contact step */}
      {isContactStep && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">Full name <span className="text-red-400">*</span></label>
            <input value={contact.full_name} onChange={e => setContact(c => ({ ...c, full_name: e.target.value }))} className={inputClass} autoComplete="name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">Phone <span className="text-red-400">*</span></label>
            <input value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} className={inputClass} type="tel" autoComplete="tel" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">City <span className="text-red-400">*</span></label>
            <input value={contact.city} onChange={e => setContact(c => ({ ...c, city: e.target.value }))} className={inputClass} autoComplete="address-level2" />
          </div>
        </div>
      )}

      {/* Authored step */}
      {!isContactStep && (
        <div className="space-y-6">
          {currentStep!.fields.map(field => {
            if (!isVisible(field, answers)) return null

            if (field.type === 'header') {
              return <h2 key={field.id} className="text-lg font-semibold text-gray-900">{field.label}</h2>
            }
            if (field.type === 'note') {
              return <p key={field.id} className="text-sm text-gray-500 whitespace-pre-line bg-gray-50 rounded-lg px-4 py-3">{field.label}</p>
            }

            const value = answers[field.id]
            return (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-800 mb-1.5">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </label>
                {field.help_text && <p className="text-xs text-gray-400 mb-2 -mt-0.5">{field.help_text}</p>}

                {field.type === 'short_text' && (
                  <input value={(value as string) ?? ''} onChange={e => setAnswer(field, e.target.value)} className={inputClass} />
                )}
                {field.type === 'paragraph' && (
                  <textarea value={(value as string) ?? ''} onChange={e => setAnswer(field, e.target.value)} rows={5} className={`${inputClass} resize-y`} />
                )}
                {field.type === 'yes_no' && (
                  <div className="flex gap-2">
                    {['Yes', 'No'].map(opt => (
                      <button key={opt} type="button" onClick={() => setAnswer(field, opt)}
                        className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          value === opt ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {field.type === 'select' && (
                  <select value={(value as string) ?? ''} onChange={e => setAnswer(field, e.target.value)} className={`${inputClass} bg-white`}>
                    <option value="">Choose…</option>
                    {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
                {field.type === 'checkbox_group' && (
                  <div className="space-y-2">
                    {(field.options ?? []).map(opt => {
                      const list = Array.isArray(value) ? value : []
                      const checked = list.includes(opt)
                      return (
                        <label key={opt} className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer">
                          <input type="checkbox" checked={checked}
                            onChange={() => setAnswer(field, checked ? list.filter(v => v !== opt) : [...list, opt])}
                            className="mt-0.5 rounded border-gray-300" />
                          <span className="leading-relaxed">{opt}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {stepError && <p className="text-sm text-red-600 mt-5">{stepError}</p>}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
        {stepIndex > 0 ? (
          <button type="button" onClick={goBack} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Back</button>
        ) : <span />}
        <button type="button" onClick={goNext} disabled={pending}
          className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
          {pending ? 'Working…' : isLastStep ? 'Submit application →' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
