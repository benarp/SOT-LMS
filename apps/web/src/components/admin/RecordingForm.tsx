'use client'

import { useState, useTransition } from 'react'
import { saveRecording, deleteRecording } from '@/app/actions/admin'
import { formatDueDate } from '@/lib/dueDate'

type Week = { id: string; week_number: number; title: string; due_date: string }
type Recording = {
  week_id: string
  title: string
  speaker: string | null
  video_url: string | null
  recorded_on: string | null
  description: string | null
}

export default function RecordingForm({ week, recording }: { week: Week; recording: Recording | null }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // A recording is only visible to students once it has a link, so an admin can
  // save the title and speaker ahead of the upload without publishing it.
  const published = !!recording?.video_url

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await saveRecording(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  function handleDelete() {
    if (!confirm(`Remove the recording for ${week.title}? Students will see this week as not posted yet.`)) return
    setError('')
    startTransition(async () => {
      const result = await deleteRecording(week.id)
      if (result?.error) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3.5">
        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xs font-medium text-gray-500 flex-shrink-0">
          {week.week_number}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${recording ? 'text-gray-900' : 'text-gray-400'}`}>
            {recording?.title ?? week.title}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {recording
              ? [
                  formatDueDate(recording.recorded_on ?? week.due_date, { month: 'short', day: 'numeric' }),
                  recording.speaker,
                  published ? 'Posted' : 'Draft — no video link',
                ].filter(Boolean).join(' · ')
              : 'Nothing posted'}
          </p>
        </div>
        {recording && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
            published ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {published ? 'Live' : 'Draft'}
          </span>
        )}
        <button
          onClick={() => setOpen(true)}
          className="text-sm text-gray-400 hover:text-gray-900 transition-colors px-2 flex-shrink-0"
        >
          {recording ? 'Edit' : 'Add'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-medium text-gray-900">
        Week {week.week_number} — {week.title}
      </h3>
      <input type="hidden" name="weekId" value={week.id} />

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
        <input
          name="title"
          required
          defaultValue={recording?.title ?? week.title}
          placeholder="The Kingdom of God"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Speaker</label>
          <input
            name="speaker"
            defaultValue={recording?.speaker ?? ''}
            placeholder="Pastor Ben Arp"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Recorded on</label>
          <input
            name="recordedOn"
            type="date"
            defaultValue={recording?.recorded_on ?? ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Video link</label>
        <input
          name="videoUrl"
          type="url"
          defaultValue={recording?.video_url ?? ''}
          placeholder="https://www.youtube.com/watch?v=…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <p className="text-xs text-gray-400 mt-1">
          Unlisted YouTube link. Leave blank to keep this week grayed out for students.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={recording?.description ?? ''}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-400 hover:text-gray-600 px-2">
          Cancel
        </button>
        {recording && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="ml-auto text-sm text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </form>
  )
}
