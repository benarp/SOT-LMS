'use client'

import { useState } from 'react'
import { createSchoolYear } from '@/app/actions/schoolYears'
import { useRouter } from 'next/navigation'

export default function CreateSchoolYearForm() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const result = await createSchoolYear(new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      ;(e.target as HTMLFormElement).reset()
      setSaving(false)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            name="name"
            type="text"
            required
            placeholder="2026–2027"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
          <input
            name="start_date"
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
          <input
            name="end_date"
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        New school years are created inactive. Use "Set as active" to switch the whole platform over.
        Set the application window after creating.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {saving ? 'Creating…' : 'Create school year'}
      </button>
    </form>
  )
}
