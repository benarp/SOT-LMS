'use client'

import { useState } from 'react'
import { setActiveSchoolYear, updateApplicationWindow } from '@/app/actions/schoolYears'
import { useRouter } from 'next/navigation'

type SchoolYear = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  applications_open_at: string | null
  applications_close_at: string | null
}

function toDatetimeLocal(iso: string | null) {
  if (!iso) return ''
  return iso.slice(0, 16) // "YYYY-MM-DDTHH:MM"
}

function formatWindow(open: string | null, close: string | null) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (!open && !close) return 'No window set — applications always closed'
  if (open && !close) return `Open from ${fmt(open)}`
  if (!open && close) return `Closes ${fmt(close)}`
  return `${fmt(open!)} – ${fmt(close!)}`
}

export default function SchoolYearCard({ year }: { year: SchoolYear }) {
  const [editingWindow, setEditingWindow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSetActive() {
    if (year.is_active) return
    setActivating(true)
    const result = await setActiveSchoolYear(year.id)
    if (result.error) setError(result.error)
    setActivating(false)
    router.refresh()
  }

  async function handleSaveWindow(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const result = await updateApplicationWindow(new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
    } else {
      setEditingWindow(false)
    }
    setSaving(false)
    router.refresh()
  }

  const now = new Date()
  const isOpen = year.applications_open_at && year.applications_close_at
    ? new Date(year.applications_open_at) <= now && now <= new Date(year.applications_close_at)
    : false

  return (
    <div className={`bg-white border rounded-xl p-5 ${year.is_active ? 'border-gray-900' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{year.name}</h3>
            {year.is_active && (
              <span className="text-xs font-medium bg-gray-900 text-white px-2 py-0.5 rounded-full">Active</span>
            )}
            {isOpen && (
              <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Applications open</span>
            )}
          </div>
          {(year.start_date || year.end_date) && (
            <p className="text-xs text-gray-400 mt-0.5">
              {year.start_date && new Date(year.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              {year.start_date && year.end_date && ' – '}
              {year.end_date && new Date(year.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {!year.is_active && (
          <button
            onClick={handleSetActive}
            disabled={activating}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {activating ? 'Setting…' : 'Set as active'}
          </button>
        )}
      </div>

      {/* Application window */}
      {!editingWindow ? (
        <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-0.5">Application window</p>
            <p className="text-xs text-gray-600">{formatWindow(year.applications_open_at, year.applications_close_at)}</p>
          </div>
          <button
            onClick={() => setEditingWindow(true)}
            className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 flex-shrink-0"
          >
            Edit
          </button>
        </div>
      ) : (
        <form onSubmit={handleSaveWindow} className="bg-gray-50 rounded-lg p-3 space-y-3">
          <input type="hidden" name="school_year_id" value={year.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Applications open</label>
              <input
                name="applications_open_at"
                type="datetime-local"
                defaultValue={toDatetimeLocal(year.applications_open_at)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Applications close</label>
              <input
                name="applications_close_at"
                type="datetime-local"
                defaultValue={toDatetimeLocal(year.applications_close_at)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">Leave both blank to keep applications closed indefinitely.</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setEditingWindow(false); setError('') }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && !editingWindow && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  )
}
