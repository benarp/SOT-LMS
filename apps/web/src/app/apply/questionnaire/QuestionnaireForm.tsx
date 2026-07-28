'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveAnswer, saveContactInfo, saveProfilePhoto } from '@/app/actions/applicationForm'
import {
  type AppField, type AnswerMap, type FormKey,
  groupIntoSteps, isVisible, stepErrors, describeSelectConstraint,
} from '@/lib/applicationForm'

type Contact = {
  full_name: string
  phone: string
  date_of_birth: string
  gender: string
  address_line1: string
  address_line2: string
  city: string
  address_region: string
  address_postal_code: string
  address_country: string
  profile_photo_name: string
}

const PHOTO_BUCKET = 'applicant-photos'
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB — images only, smaller than the homework-uploads cap

const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent'

export default function QuestionnaireForm({
  fields, initialAnswers, contact: initialContact, schoolYearName, preview = false,
  formKey, onSubmit, afterSubmitPath, initialHonestyAcknowledged = false,
}: {
  fields: AppField[]
  initialAnswers: AnswerMap
  contact: Contact
  schoolYearName: string
  /** Admin preview: fully interactive (branching included) but never persists or submits. */
  preview?: boolean
  formKey: FormKey
  /** Server action to call on final submit — parent injects the right one (application vs wellness). */
  onSubmit: (honestyAcknowledged: boolean) => Promise<{ error?: string }>
  afterSubmitPath: string
  initialHonestyAcknowledged?: boolean
}) {
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers)
  const [contact, setContact] = useState<Contact>(initialContact)
  const [stepIndex, setStepIndex] = useState(0)
  const [stepError, setStepError] = useState('')
  const [saving, setSaving] = useState(false)
  const [honestyAcknowledged, setHonestyAcknowledged] = useState(initialHonestyAcknowledged)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const hasContactStep = formKey === 'application'
  const formSteps = useMemo(() => groupIntoSteps(fields), [fields])
  // Optional contact step, then authored steps, then a review/submit step
  const totalSteps = formSteps.length + (hasContactStep ? 1 : 0) + 1
  const isContactStep = hasContactStep && stepIndex === 0
  const isReviewStep = stepIndex === totalSteps - 1
  const authoredIndex = stepIndex - (hasContactStep ? 1 : 0)
  const currentStep = !isContactStep && !isReviewStep ? formSteps[authoredIndex] : null
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
    fd.set('date_of_birth', contact.date_of_birth)
    fd.set('gender', contact.gender)
    fd.set('address_line1', contact.address_line1)
    fd.set('address_line2', contact.address_line2)
    fd.set('city', contact.city)
    fd.set('address_region', contact.address_region)
    fd.set('address_postal_code', contact.address_postal_code)
    fd.set('address_country', contact.address_country)
    return saveContactInfo(fd)
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setStepError('Please upload an image file.'); return }
    if (file.size > MAX_PHOTO_BYTES) { setStepError('Image must be under 5MB.'); return }
    setStepError('')

    if (preview) { setContact(c => ({ ...c, profile_photo_name: file.name })); return }

    setPhotoUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStepError('You appear to be signed out — please sign back in.'); setPhotoUploading(false); return }

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}/profile-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file)
    if (uploadError) { setStepError(uploadError.message); setPhotoUploading(false); return }

    const result = await saveProfilePhoto(path, file.name)
    setPhotoUploading(false)
    if (result.error) { setStepError(result.error); return }
    setContact(c => ({ ...c, profile_photo_name: file.name }))
  }

  function validateCurrentStep(): string {
    if (isContactStep) {
      if (!contact.full_name.trim() || !contact.phone.trim() || !contact.date_of_birth || !contact.gender
        || !contact.address_line1.trim() || !contact.city.trim()) {
        return 'Please complete your name, phone, birthdate, gender, and address.'
      }
      if (!contact.profile_photo_name) return 'Please upload a profile photo.'
      return ''
    }
    if (isReviewStep) {
      return honestyAcknowledged ? '' : 'Please acknowledge the honesty statement before submitting.'
    }
    return stepErrors(currentStep!.fields, answers)
  }

  function goNext() {
    const error = validateCurrentStep()
    setStepError(error)
    if (error) return
    if (preview && isReviewStep) {
      setStepError('End of preview — submitting is disabled here.')
      return
    }
    startTransition(async () => {
      if (isContactStep && !preview) {
        const result = await flushContact()
        if (result.error) { setStepError(result.error); return }
      }
      if (isReviewStep) {
        if (!preview) {
          const result = await onSubmit(honestyAcknowledged)
          if (result.error) { setStepError(result.error); return }
        }
        router.push(afterSubmitPath)
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

  function jumpToStep(index: number) {
    setStepError('')
    setStepIndex(index)
    window.scrollTo({ top: 0 })
  }

  function formatAnswer(field: AppField): string {
    const value = answers[field.id]
    if (!value || (Array.isArray(value) && value.length === 0)) return '—'
    return Array.isArray(value) ? value.join(', ') : value
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs text-gray-400">
            Step {stepIndex + 1} of {totalSteps}
            {' — '}
            <span className="text-gray-600 font-medium">
              {isContactStep ? 'Profile' : isReviewStep ? 'Review' : currentStep!.title}
            </span>
          </p>
          <p className="text-xs text-gray-300">{preview ? 'Preview — nothing is saved' : saving ? 'Saving…' : 'Saved automatically'}</p>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gray-900 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-6">Applying for {schoolYearName}</p>

      {/* Profile / contact step */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">Birthdate <span className="text-red-400">*</span></label>
              <input value={contact.date_of_birth} onChange={e => setContact(c => ({ ...c, date_of_birth: e.target.value }))} className={inputClass} type="date" autoComplete="bday" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">Gender <span className="text-red-400">*</span></label>
              <select value={contact.gender} onChange={e => setContact(c => ({ ...c, gender: e.target.value }))} className={`${inputClass} bg-white`}>
                <option value="">Choose…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">Address line 1 <span className="text-red-400">*</span></label>
            <input value={contact.address_line1} onChange={e => setContact(c => ({ ...c, address_line1: e.target.value }))} className={inputClass} autoComplete="address-line1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">Address line 2</label>
            <input value={contact.address_line2} onChange={e => setContact(c => ({ ...c, address_line2: e.target.value }))} className={inputClass} autoComplete="address-line2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">City <span className="text-red-400">*</span></label>
              <input value={contact.city} onChange={e => setContact(c => ({ ...c, city: e.target.value }))} className={inputClass} autoComplete="address-level2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">State / region <span className="text-red-400">*</span></label>
              <input value={contact.address_region} onChange={e => setContact(c => ({ ...c, address_region: e.target.value }))} className={inputClass} autoComplete="address-level1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1.5">Postal code <span className="text-red-400">*</span></label>
              <input value={contact.address_postal_code} onChange={e => setContact(c => ({ ...c, address_postal_code: e.target.value }))} className={inputClass} autoComplete="postal-code" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">Country <span className="text-red-400">*</span></label>
            <input value={contact.address_country} onChange={e => setContact(c => ({ ...c, address_country: e.target.value }))} className={inputClass} autoComplete="country-name" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1.5">Profile photo <span className="text-red-400">*</span></label>
            <p className="text-xs text-gray-400 mb-2 -mt-0.5">Square photo with your face centered in the frame works best.</p>
            <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={photoUploading}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" />
            {photoUploading && <p className="text-xs text-gray-400 mt-1.5">Uploading…</p>}
            {!photoUploading && contact.profile_photo_name && <p className="text-xs text-gray-500 mt-1.5">Uploaded: {contact.profile_photo_name}</p>}
          </div>
        </div>
      )}

      {/* Authored step */}
      {currentStep && (
        <div className="space-y-6">
          {currentStep.fields.map(field => {
            if (!isVisible(field, answers)) return null

            if (field.type === 'header') {
              return <h2 key={field.id} className="text-lg font-semibold text-gray-900">{field.label}</h2>
            }
            if (field.type === 'note') {
              return <p key={field.id} className="text-sm text-gray-500 whitespace-pre-line bg-gray-50 rounded-lg px-4 py-3">{field.label}</p>
            }

            const value = answers[field.id]
            const constraint = describeSelectConstraint(field)
            return (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-800 mb-1.5">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </label>
                {field.help_text && <p className="text-xs text-gray-400 mb-2 -mt-0.5">{field.help_text}</p>}
                {constraint && <p className="text-xs text-gray-400 mb-2 -mt-0.5">{constraint}</p>}

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

      {/* Review step */}
      {isReviewStep && (
        <div className="space-y-6">
          {hasContactStep && (
            <div className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Profile</p>
                <button type="button" onClick={() => jumpToStep(0)} className="text-xs text-gray-500 underline underline-offset-2">Edit</button>
              </div>
              <p className="text-sm text-gray-700">{contact.full_name} · {contact.phone} · {contact.date_of_birth} · {contact.gender}</p>
              <p className="text-sm text-gray-700 mt-0.5">
                {[contact.address_line1, contact.address_line2, contact.city, contact.address_region, contact.address_postal_code, contact.address_country]
                  .filter(Boolean).join(', ')}
              </p>
              {contact.profile_photo_name && <p className="text-sm text-gray-500 mt-0.5">Photo: {contact.profile_photo_name}</p>}
            </div>
          )}

          {formSteps.map((step, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{step.title}</p>
                <button type="button" onClick={() => jumpToStep(i + (hasContactStep ? 1 : 0))} className="text-xs text-gray-500 underline underline-offset-2">Edit</button>
              </div>
              <div className="space-y-2">
                {step.fields.filter(f => f.type !== 'header' && f.type !== 'note' && isVisible(f, answers)).map(f => (
                  <div key={f.id}>
                    <p className="text-sm text-gray-800">{f.label}</p>
                    <p className="text-sm text-gray-500">{formatAnswer(f)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <label className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer bg-gray-50 rounded-lg px-4 py-3">
            <input type="checkbox" checked={honestyAcknowledged} onChange={e => setHonestyAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-gray-300" />
            <span className="leading-relaxed">
              {formKey === 'wellness'
                ? 'I have answered all of the above questions truthfully. I understand this information is shared with pastoral staff and kept confidential (except as required by law to report abuse or neglect of minors).'
                : 'I agree that I answered the questions on this application honestly and wholeheartedly.'}
            </span>
          </label>
        </div>
      )}

      {stepError && <p className="text-sm text-red-600 mt-5">{stepError}</p>}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
        {stepIndex > 0 ? (
          <button type="button" onClick={goBack} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Back</button>
        ) : <span />}
        <button type="button" onClick={goNext} disabled={pending || photoUploading}
          className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
          {pending ? 'Working…' : isReviewStep ? 'Submit →' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
