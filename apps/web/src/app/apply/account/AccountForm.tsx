'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { initApplicant, getApplicationStep } from '@/app/actions/apply'

export default function AccountForm() {
  const params = useSearchParams()
  const [mode, setMode] = useState<'signup' | 'signin'>(params.get('mode') === 'signin' ? 'signin' : 'signup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }
      const result = await initApplicant(fullName)
      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      router.push('/apply/questionnaire')
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Invalid email or password.')
        setLoading(false)
        return
      }
      const { step } = await getApplicationStep()
      router.push(`/apply/${step}`)
    }
  }

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {mode === 'signup' ? 'Create your account' : 'Sign in to continue'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {mode === 'signup'
            ? "You'll use this to save your progress and check your application status."
            : 'Welcome back — pick up where you left off.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Jane Smith"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {mode === 'signup' ? 'Create a password' : 'Password'}
            </label>
            <input
              type="password"
              required
              minLength={mode === 'signup' ? 8 : undefined}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="••••••••"
            />
            {mode === 'signup' && <p className="text-xs text-gray-400 mt-1">At least 8 characters</p>}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : (mode === 'signup' ? 'Create account & continue' : 'Sign in & continue')}
          </button>
        </form>
      </div>

      <p className="text-sm text-gray-400 text-center mt-4">
        {mode === 'signup' ? 'Already have an account?' : 'Need to create an account?'}{' '}
        <button
          onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError('') }}
          className="text-gray-600 underline underline-offset-2"
        >
          {mode === 'signup' ? 'Sign in instead' : 'Sign up'}
        </button>
      </p>
    </div>
  )
}
