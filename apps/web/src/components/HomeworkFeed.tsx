'use client'

import { useState, useTransition } from 'react'
import { markComplete, markIncomplete } from '@/app/actions/submissions'

type HomeworkItem = {
  id: string
  type: 'bible_reading' | 'video' | 'book_reflection' | 'written'
  title: string
  description: string | null
  external_url: string | null
  content: string | null
  book_id: string | null
  sort_order: number
  completed: boolean
}

const typeConfig = {
  bible_reading: {
    label: 'Bible reading',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  video: {
    label: 'Video',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  book_reflection: {
    label: 'Book reflection',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  written: {
    label: 'Written submission',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
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
    // Bible Project and other embeddable URLs
    return url
  } catch {
    return null
  }
}

export default function HomeworkFeed({
  items,
  studentId,
  weekId,
}: {
  items: HomeworkItem[]
  studentId: string
  weekId: string
}) {
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map(i => [i.id, i.completed]))
  )
  const [pending, startTransition] = useTransition()

  function toggle(item: HomeworkItem) {
    const nowComplete = !optimistic[item.id]
    setOptimistic(prev => ({ ...prev, [item.id]: nowComplete }))
    startTransition(async () => {
      try {
        if (nowComplete) {
          await markComplete(item.id, '')
        } else {
          await markIncomplete(item.id)
        }
      } catch {
        setOptimistic(prev => ({ ...prev, [item.id]: !nowComplete }))
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
        const config = typeConfig[item.type]
        const embedUrl = item.type === 'video' && item.external_url ? getEmbedUrl(item.external_url) : null
        const days = item.type === 'bible_reading' && item.content
          ? item.content.split('\n').filter(l => l.trim().length > 0)
          : []

        return (
          <div
            key={item.id}
            className={`bg-white border rounded-xl p-4 transition-all ${
              done ? 'border-gray-100 opacity-60' : 'border-gray-200'
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

                {/* Bible reading day-by-day */}
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

                {/* Written instructions */}
                {item.type === 'written' && item.content && !done && (
                  <p className="mt-2 text-sm text-gray-500 whitespace-pre-line">{item.content}</p>
                )}
              </div>

              {/* Complete button */}
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
