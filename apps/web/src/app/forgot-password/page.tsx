'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    // Always show success — don't reveal whether the email exists
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium text-gray-900">Reset your password</h1>
          <p className="mt-1 text-sm text-gray-500">We&rsquo;ll email you a link to set a new one</p>
        </div>

        {sent ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-3">
            <p className="text-sm text-gray-700">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.
            </p>
            <p className="text-sm text-gray-400">Check your spam folder if you don&rsquo;t see it.</p>
            <Link href="/login" className="inline-block text-sm text-gray-900 underline underline-offset-2">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-8 space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="text-center">
              <Link href="/login" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
