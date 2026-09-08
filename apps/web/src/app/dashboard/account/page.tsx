'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'
import { BIBLE_PLAN_LABELS, DEFAULT_BIBLE_PLAN, asBiblePlan, type BiblePlan } from '@/lib/biblePlan'

type Status = { kind: 'success' | 'error'; message: string } | null

function StatusLine({ status }: { status: Status }) {
  if (!status) return null
  return (
    <p className={`text-sm ${status.kind === 'error' ? 'text-red-600' : 'text-green-600'}`}>
      {status.message}
    </p>
  )
}

export default function AccountPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [originalBirthday, setOriginalBirthday] = useState('')
  const [birthdayStatus, setBirthdayStatus] = useState<Status>(null)
  const [email, setEmail] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nameStatus, setNameStatus] = useState<Status>(null)
  const [emailStatus, setEmailStatus] = useState<Status>(null)
  const [passwordStatus, setPasswordStatus] = useState<Status>(null)
  const [saving, setSaving] = useState<'name' | 'email' | 'password' | 'birthday' | null>(null)
  const [biblePlan, setBiblePlan] = useState<BiblePlan>(DEFAULT_BIBLE_PLAN)
  const [planStatus, setPlanStatus] = useState<Status>(null)
  const [savingPlan, setSavingPlan] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, birthday, bible_plan')
        .eq('id', user.id)
        .single()
      setName(profile?.full_name ?? '')
      setOriginalName(profile?.full_name ?? '')
      setBirthday(profile?.birthday ?? '')
      setOriginalBirthday(profile?.birthday ?? '')
      setBiblePlan(asBiblePlan(profile?.bible_plan))
      setEmail(user.email ?? '')
      setOriginalEmail(user.email ?? '')
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setNameStatus(null)
    setSaving('name')
    const { error } = await supabase.rpc('update_own_name', { new_name: name.trim() })
    setSaving(null)
    if (error) { setNameStatus({ kind: 'error', message: error.message }); return }
    setOriginalName(name.trim())
    setNameStatus({ kind: 'success', message: 'Name updated.' })
  }

  async function saveBirthday(e: React.FormEvent) {
    e.preventDefault()
    setBirthdayStatus(null)
    setSaving('birthday')
    const { error } = await supabase.rpc('update_own_birthday', { new_birthday: birthday || null })
    setSaving(null)
    if (error) { setBirthdayStatus({ kind: 'error', message: error.message }); return }
    setOriginalBirthday(birthday)
    setBirthdayStatus({ kind: 'success', message: 'Birthday saved.' })
  }

  async function selectPlan(plan: BiblePlan) {
    if (plan === biblePlan || savingPlan) return
    const previous = biblePlan
    setPlanStatus(null)
    setSavingPlan(true)
    setBiblePlan(plan)
    const { error } = await supabase.rpc('update_own_bible_plan', { new_plan: plan })
    setSavingPlan(false)
    if (error) {
      setBiblePlan(previous)
      setPlanStatus({ kind: 'error', message: error.message })
      return
    }
    setPlanStatus({ kind: 'success', message: `Switched to the ${BIBLE_PLAN_LABELS[plan]}.` })
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailStatus(null)
    setSaving('email')
    const next = email.trim().toLowerCase()
    const { error } = await supabase.auth.updateUser({ email: next })
    setSaving(null)
    if (error) { setEmailStatus({ kind: 'error', message: error.message }); return }
    setEmailStatus({
      kind: 'success',
      message: `Confirmation link sent to ${next}. Your email won't change until you click it.`,
    })
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordStatus(null)
    if (newPassword.length < 8) {
      setPasswordStatus({ kind: 'error', message: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ kind: 'error', message: 'The two passwords do not match.' })
      return
    }
    setSaving('password')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(null)
    if (error) { setPasswordStatus({ kind: 'error', message: error.message }); return }
    setNewPassword('')
    setConfirmPassword('')
    setPasswordStatus({ kind: 'success', message: 'Password changed.' })
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading…</p>
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent'
  const buttonClass = 'bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50'

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-medium text-gray-900 mb-1">Account</h1>
      <p className="text-sm text-gray-400 mb-8">Update your appearance, name, email, or password.</p>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <p className="text-sm font-medium text-gray-700 mb-1">Appearance</p>
        <p className="text-xs text-gray-400 mb-4">Choose a theme for this device. &ldquo;System&rdquo; follows your device settings.</p>
        <ThemeToggle />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <p className="text-sm font-medium text-gray-700 mb-1">Bible Reading Plan</p>
        <p className="text-xs text-gray-400 mb-4">
          Choose how much you&apos;re reading this year. Your weekly homework updates to match.
          Past weeks keep the plan you were on at the time.
        </p>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(['shorter', 'whole'] as const).map(plan => {
            const active = biblePlan === plan
            return (
              <button
                key={plan}
                type="button"
                onClick={() => selectPlan(plan)}
                disabled={savingPlan}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                  active
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                aria-pressed={active}
              >
                {BIBLE_PLAN_LABELS[plan]}
              </button>
            )
          })}
        </div>
        <div className="mt-3"><StatusLine status={planStatus} /></div>
      </div>

      <form onSubmit={saveName} className="bg-white border border-gray-200 rounded-xl p-6 mb-5 space-y-4">
        <div>
          <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
          <input id="full-name" type="text" required value={name} onChange={e => setName(e.target.value)} className={inputClass} autoComplete="name" />
        </div>
        <StatusLine status={nameStatus} />
        {name.trim() !== originalName && name.trim().length > 0 && (
          <button type="submit" disabled={saving === 'name'} className={buttonClass}>
            {saving === 'name' ? 'Saving…' : 'Save name'}
          </button>
        )}
      </form>

      <form onSubmit={saveBirthday} className="bg-white border border-gray-200 rounded-xl p-6 mb-5 space-y-4">
        <div>
          <label htmlFor="birthday" className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
          <input id="birthday" type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className={inputClass} autoComplete="bday" />
          <p className="text-xs text-gray-400 mt-2">So the school can celebrate you. Only staff can see it.</p>
        </div>
        <StatusLine status={birthdayStatus} />
        {birthday !== originalBirthday && (
          <button type="submit" disabled={saving === 'birthday'} className={buttonClass}>
            {saving === 'birthday' ? 'Saving…' : 'Save birthday'}
          </button>
        )}
      </form>

      <form onSubmit={saveEmail} className="bg-white border border-gray-200 rounded-xl p-6 mb-5 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} autoComplete="email" />
          <p className="text-xs text-gray-400 mt-2">Changing your email sends a confirmation link to the new address.</p>
        </div>
        <StatusLine status={emailStatus} />
        {email.trim().toLowerCase() !== originalEmail && email.trim().length > 0 && (
          <button type="submit" disabled={saving === 'email'} className={buttonClass}>
            {saving === 'email' ? 'Sending…' : 'Update email'}
          </button>
        )}
      </form>

      <form onSubmit={savePassword} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
          <input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
          <input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
        </div>
        <StatusLine status={passwordStatus} />
        {newPassword.length > 0 && (
          <button type="submit" disabled={saving === 'password'} className={buttonClass}>
            {saving === 'password' ? 'Saving…' : 'Change password'}
          </button>
        )}
      </form>
    </div>
  )
}
