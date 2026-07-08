'use client'

import { useRef, useState, useTransition } from 'react'
import { markComplete, markIncomplete, submitReflection, saveReflectionFile, removeReflectionFile } from '@/app/actions/submissions'
import { createClient } from '@/lib/supabase/client'

type ResponseFile = { path: string; name: string; url: string | null }

type HomeworkItem = {
  id: string
  type: string
  title: string
  description: string | null
  external_url: string | null
  content: string | null
  sort_order: number
  completed: boolean
  response: string | null
  responseFile?: ResponseFile | null
  show_attribution?: boolean
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif', 'application/pdf']
const isImageFile = (name: string) => /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(name)

const bookIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
)

const reflectionIcon = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const typeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  bible_reading: { label: 'Scripture Reading', icon: bookIcon },
  book_reading: { label: 'Book Reading', icon: bookIcon },
  video: {
    label: 'Video',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  reflection: { label: 'Reflection', icon: reflectionIcon },
}

function getEmbedUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim())
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const videoId = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v') ?? u.pathname.split('/').pop()
      if (videoId) return `https://www.youtube.com/embed/${videoId}?rel=0`
    }
    if (u.hostname.includes('vimeo.com')) {
      const videoId = u.pathname.split('/').filter(Boolean).pop()
      if (videoId) return `https://player.vimeo.com/video/${videoId}`
    }
    // Other sites (e.g. Bible Project) typically block iframing — link out instead
    return null
  } catch {
    return null
  }
}

const isReflectionType = (type: string) => type === 'reflection'
const isReadingType = (type: string) => type === 'bible_reading' || type === 'book_reading'

export default function HomeworkFeed({
  items,
  studentId,
  weekId,
  weekDueDate,
}: {
  items: HomeworkItem[]
  studentId: string
  weekId: string
  weekDueDate: string
}) {
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map(i => [i.id, i.completed]))
  )
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(items.map(i => [i.id, i.response ?? '']))
  )
  const [files, setFiles] = useState<Record<string, ResponseFile | null>>(
    Object.fromEntries(items.map(i => [i.id, i.responseFile ?? null]))
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  function toggle(item: HomeworkItem) {
    const nowComplete = !optimistic[item.id]
    setOptimistic(prev => ({ ...prev, [item.id]: nowComplete }))
    startTransition(async () => {
      try {
        if (nowComplete) {
          await markComplete(item.id, weekDueDate)
        } else {
          await markIncomplete(item.id)
        }
      } catch {
        setOptimistic(prev => ({ ...prev, [item.id]: !nowComplete }))
      }
    })
  }

  function saveReflection(item: HomeworkItem) {
    const text = drafts[item.id] ?? ''
    setErrors(prev => ({ ...prev, [item.id]: '' }))
    setSavingId(item.id)
    startTransition(async () => {
      const result = await submitReflection(item.id, weekDueDate, text)
      setSavingId(null)
      if (result.error) {
        setErrors(prev => ({ ...prev, [item.id]: result.error! }))
        return
      }
      setOptimistic(prev => ({ ...prev, [item.id]: true }))
    })
  }

  async function uploadFile(item: HomeworkItem, file: File) {
    setErrors(prev => ({ ...prev, [item.id]: '' }))
    if (!UPLOAD_TYPES.includes(file.type) && !isImageFile(file.name)) {
      setErrors(prev => ({ ...prev, [item.id]: 'Please choose a photo or PDF.' }))
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrors(prev => ({ ...prev, [item.id]: 'That file is over 10 MB — try a smaller photo.' }))
      return
    }
    setUploadingId(item.id)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${item.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('homework-uploads')
        .upload(path, file, { contentType: file.type || undefined })
      if (uploadError) throw new Error(uploadError.message)

      const result = await saveReflectionFile(item.id, weekDueDate, path, file.name)
      if (result.error) throw new Error(result.error)

      // Local preview immediately; a signed URL replaces it on next load
      setFiles(prev => ({ ...prev, [item.id]: { path, name: file.name, url: URL.createObjectURL(file) } }))
      setOptimistic(prev => ({ ...prev, [item.id]: true }))
    } catch (err) {
      setErrors(prev => ({ ...prev, [item.id]: err instanceof Error ? err.message : 'Upload failed. Try again.' }))
    } finally {
      setUploadingId(null)
    }
  }

  function removeFile(item: HomeworkItem) {
    setErrors(prev => ({ ...prev, [item.id]: '' }))
    startTransition(async () => {
      const result = await removeReflectionFile(item.id)
      if (result.error) {
        setErrors(prev => ({ ...prev, [item.id]: result.error! }))
        return
      }
      setFiles(prev => ({ ...prev, [item.id]: null }))
      // Item stays complete only if a typed response remains
      if (!(drafts[item.id] ?? '').trim() || !(item.response ?? '').trim()) {
        setOptimistic(prev => ({ ...prev, [item.id]: !!(item.response ?? '').trim() }))
      }
    })
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-400">No homework items for this week yet.</p>
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const done = optimistic[item.id]
        const config = typeConfig[item.type] ?? typeConfig.reflection
        const embedUrl = item.type === 'video' && item.external_url ? getEmbedUrl(item.external_url) : null
        const days = isReadingType(item.type) && item.content
          ? item.content.split('\n').filter(l => l.trim().length > 0)
          : []
        const reflection = isReflectionType(item.type)

        return (
          <div
            key={item.id}
            className={`bg-white border rounded-xl p-4 transition-all ${
              done ? `border-gray-100${reflection ? '' : ' opacity-60'}` : 'border-gray-200'
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Type icon */}
              <div className={`mt-0.5 flex-shrink-0 ${done ? 'text-gray-300' : 'text-gray-400'}`}>
                {config.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-gray-400">{config.label}</span>
                </div>
                <p className={`text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                )}

                {/* Video embed */}
                {embedUrl && !done && (
                  <div className="mt-3 rounded-xl overflow-hidden aspect-video">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                {item.type === 'video' && item.external_url && !embedUrl && !done && (
                  <a
                    href={item.external_url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    Watch video →
                  </a>
                )}
                {item.type === 'video' && item.show_attribution !== false && !done && (
                  <p className="mt-2 text-xs text-gray-400">
                    Video provided by BibleProject — explore all their content at{' '}
                    <a href="https://bibleproject.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                      bibleproject.com
                    </a>
                  </p>
                )}

                {/* Reading plan day-by-day */}
                {days.length > 0 && !done && (
                  <ul className="mt-3 space-y-1.5">
                    {days.map((day, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                        {day}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Reflection: prompt + response box + journal photo */}
                {reflection && (() => {
                  const attached = files[item.id]
                  const hasDraft = (drafts[item.id] ?? '').trim().length > 0
                  return (
                    <div className="mt-3">
                      {item.content && !done && (
                        <p className="text-sm text-gray-500 whitespace-pre-line mb-2">{item.content}</p>
                      )}
                      <textarea
                        value={drafts[item.id] ?? ''}
                        onChange={e => setDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                        rows={done ? 3 : 5}
                        placeholder={attached ? 'Add a note (optional)…' : 'Write your response here…'}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-y"
                      />

                      {/* Attached journal photo / file */}
                      {attached && (
                        <div className="mt-2 flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg p-2">
                          {attached.url && isImageFile(attached.name) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={attached.url} alt="Your journal photo" className="w-16 h-16 object-cover rounded-md border border-gray-200" />
                          ) : (
                            <span className="text-xl px-2" aria-hidden>📎</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{attached.name}</p>
                            <p className="text-xs text-green-600">✓ Counts as your response</p>
                          </div>
                          {attached.url && (
                            <a href={attached.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-700 underline flex-shrink-0">View</a>
                          )}
                          <button
                            onClick={() => removeFile(item)}
                            disabled={pending}
                            className="flex-shrink-0 text-gray-300 hover:text-red-500 px-1.5 text-sm"
                            aria-label="Remove upload"
                          >✕</button>
                        </div>
                      )}

                      {errors[item.id] && <p className="text-xs text-red-600 mt-1">{errors[item.id]}</p>}

                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        {((drafts[item.id] ?? '').trim() !== (item.response ?? '').trim() && hasDraft) || (!done && hasDraft) ? (
                          <button
                            onClick={() => saveReflection(item)}
                            disabled={savingId === item.id}
                            className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                          >
                            {savingId === item.id ? 'Saving…' : done ? 'Update response' : 'Save response'}
                          </button>
                        ) : done && (hasDraft || attached) ? (
                          <p className="text-xs text-green-600">✓ Response saved</p>
                        ) : null}

                        {!attached && (
                          <>
                            <input
                              ref={el => { fileInputs.current[item.id] = el }}
                              type="file"
                              accept="image/*,.pdf,.heic,.heif"
                              className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) uploadFile(item, file)
                                e.target.value = ''
                              }}
                            />
                            <button
                              onClick={() => fileInputs.current[item.id]?.click()}
                              disabled={uploadingId === item.id}
                              className="text-xs text-gray-500 hover:text-gray-900 underline underline-offset-2 disabled:opacity-50"
                            >
                              {uploadingId === item.id
                                ? 'Uploading…'
                                : hasDraft || done
                                ? '📷 Add a photo'
                                : '📷 Prefer pen and paper? Add a photo of your journal instead'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Complete button — reflections complete by saving a response */}
              {!reflection && (
                <button
                  onClick={() => toggle(item)}
                  disabled={pending}
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    done
                      ? 'bg-gray-900 border-gray-900'
                      : 'border-gray-300 hover:border-gray-500'
                  }`}
                  aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                >
                  {done && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )}
              {reflection && done && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
