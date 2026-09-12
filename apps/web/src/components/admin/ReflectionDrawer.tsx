'use client'

import { useEffect, useRef } from 'react'

export type Reflection = {
  key: string
  studentName: string
  groupName: string | null
  phone: string | null
  phoneHref: string | null
  weekLabel: string
  itemTitle: string
  text: string | null
  fileUrl: string | null
  fileName: string | null
  isImage: boolean
  isLate: boolean
  completedAt: string | null
  completedLabel: string
}

type Props = {
  reflections: Reflection[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export default function ReflectionDrawer({ reflections, index, onClose, onNavigate }: Props) {
  const reflection = reflections[index]
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const hasPrevious = index > 0
  const hasNext = index < reflections.length - 1

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  // Long reflections leave the panel scrolled partway down; start each one at the top.
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0)
  }, [index])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft' && hasPrevious) { onNavigate(index - 1); return }
      if (e.key === 'ArrowRight' && hasNext) onNavigate(index + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, hasPrevious, hasNext, onClose, onNavigate])

  if (!reflection) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Reflection by ${reflection.studentName}`}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-white border-l border-gray-200 flex flex-col"
      >
        <header className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{reflection.studentName}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {reflection.groupName ?? 'No group'}
              {reflection.phone && (
                <>
                  {' · '}
                  {reflection.phoneHref
                    ? <a href={reflection.phoneHref} className="text-blue-600 hover:underline">{reflection.phone}</a>
                    : reflection.phone}
                </>
              )}
            </p>
            <p className="text-xs font-medium text-green-600 mt-1.5">
              Submitted{reflection.isLate ? ' (late)' : ''}
              {reflection.completedLabel && <span className="font-normal text-gray-400"> · {reflection.completedLabel}</span>}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close reflection"
            className="text-gray-300 hover:text-gray-600 transition-colors p-1 flex-shrink-0 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[10px] text-gray-300 uppercase tracking-wide mb-2">
            {reflection.weekLabel} · {reflection.itemTitle}
          </p>

          {reflection.text && (
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{reflection.text}</p>
          )}

          {reflection.fileUrl && (
            <a href={reflection.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-4">
              {reflection.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={reflection.fileUrl} alt="Journal upload" className="rounded-lg border border-gray-200 max-w-full" />
              ) : (
                <span className="text-sm text-blue-600 underline">📎 {reflection.fileName ?? 'Uploaded file'}</span>
              )}
            </a>
          )}

          {!reflection.text && !reflection.fileUrl && (
            <p className="text-sm text-gray-400">This reflection is empty.</p>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate(index - 1)}
            disabled={!hasPrevious}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:hover:text-gray-500 cursor-pointer disabled:cursor-default"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-400">{index + 1} of {reflections.length}</span>
          <button
            type="button"
            onClick={() => onNavigate(index + 1)}
            disabled={!hasNext}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:hover:text-gray-500 cursor-pointer disabled:cursor-default"
          >
            Next →
          </button>
        </footer>
      </div>
    </>
  )
}
