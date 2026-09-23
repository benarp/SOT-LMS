'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { setReflectionRotation } from '@/app/actions/submissions'

export type Reflection = {
  key: string
  submissionId: string
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
  /** Clockwise degrees an admin has already straightened this photo by. */
  rotation: number
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

          {reflection.fileUrl && reflection.isImage && (
            // Keyed by reflection so each photo starts from its own saved rotation
            // rather than inheriting the last one's turn.
            <RotatableImage
              key={reflection.key}
              src={reflection.fileUrl}
              submissionId={reflection.submissionId}
              initialRotation={reflection.rotation}
            />
          )}

          {reflection.fileUrl && !reflection.isImage && (
            <a href={reflection.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-4">
              <span className="text-sm text-blue-600 underline">📎 {reflection.fileName ?? 'Uploaded file'}</span>
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

/** A photo someone may have shot sideways, with quarter-turn controls for reading it. */
function RotatableImage({
  src,
  submissionId,
  initialRotation,
}: {
  src: string
  submissionId: string
  initialRotation: number
}) {
  const [rotation, setRotation] = useState(initialRotation)
  const [aspect, setAspect] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const quarterTurned = rotation % 180 !== 0

  // The turn shows immediately and saves behind it; if the save fails the photo
  // stays where the admin put it for this viewing, with the reason said plainly.
  function turn(degrees: number) {
    const next = (rotation + degrees + 360) % 360
    setRotation(next)
    setFailed(false)
    setReflectionRotation(submissionId, next)
      .then(res => setFailed(!!res?.error))
      .catch(() => setFailed(true))
  }

  function measure(img: HTMLImageElement | null) {
    if (img?.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight)
  }

  // An image restored from cache can finish loading before React attaches onLoad, so the
  // ref measures whatever is already there and onLoad only covers the still-loading case.
  const measureRef = useCallback((img: HTMLImageElement | null) => { measure(img) }, [])

  // Until the photo is measured it stays in normal flow at full width — the rotating frame
  // below takes its height from aspectRatio, which would collapse to nothing without it.
  // A quarter turn swaps the photo's axes, so the image is then drawn at the container's
  // height (its width x aspect) for the rotated result to fill the panel exactly.
  return (
    <div className="mt-4">
      <div
        className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
        style={aspect ? { aspectRatio: quarterTurned ? 1 / aspect : aspect } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={measureRef}
          src={src}
          alt="Journal upload"
          onLoad={e => measure(e.currentTarget)}
          className={
            aspect
              ? 'absolute left-1/2 top-1/2 max-w-none transition-transform duration-200'
              : 'block w-full'
          }
          style={aspect ? {
            width: quarterTurned ? `${aspect * 100}%` : '100%',
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          } : undefined}
        />
      </div>
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => turn(-90)}
          title="Rotate left"
          aria-label="Rotate image left"
          className="text-gray-400 hover:text-gray-900 transition-colors p-1 cursor-pointer"
        >
          <svg className="w-4 h-4 -scale-x-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M4.6 13a8 8 0 103-7.6L4 9" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => turn(90)}
          title="Rotate right"
          aria-label="Rotate image right"
          className="text-gray-400 hover:text-gray-900 transition-colors p-1 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M4.6 13a8 8 0 103-7.6L4 9" />
          </svg>
        </button>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-xs text-gray-400 hover:text-gray-900 transition-colors"
        >
          Open original
        </a>
        {failed && (
          <span className="text-xs text-amber-600">Rotation didn&apos;t save</span>
        )}
      </div>
    </div>
  )
}
