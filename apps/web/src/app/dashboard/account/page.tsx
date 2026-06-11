'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Status = { kind: 'success' | 'error'; message: string } | null

export default function AccountPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [email, setEmail] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nameStatus, setNameStatus] = useState<Status>(null)
  const [emailStatus, setEmailStatus] = useState<Status>(null)
  const [passwordStatus, setPasswordStatus] = useState<Status>(null)
  const [saving, setSaving] = useState<'name' | 'email' | 'password' | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      setName(profile?.full_name ?? '')
      setOriginalName(profile?.full_name ?? '')
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

  function StatusLine({ status }: { status: Status }) {
    if (!status) return null
    return (
      <p className={`text-sm ${status.kind === 'error' ? 'text-red-600' : 'text-green-600'}`}>
        {status.message}
      </p>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-medium text-gray-900 mb-1">Account</h1>
      <p className="text-sm text-gray-400 mb-8">Update your name, email, or password.</p>

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
