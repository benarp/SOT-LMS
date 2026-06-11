'use client'

import { useTransition } from 'react'
import { endImpersonation } from '@/app/actions/impersonate'

export default function ImpersonationBanner({ studentName }: { studentName: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between sticky top-0 z-50">
      <p className="text-sm text-amber-800">
        Viewing as <span className="font-medium">{studentName}</span> — actions you take are recorded as them
      </p>
      <button
        onClick={() => startTransition(() => endImpersonation())}
        disabled={isPending}
        className="text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors border border-amber-300 rounded-lg px-2 py-1 disabled:opacity-50"
      >
        {isPending ? 'Returning…' : 'Exit — back to admin'}
      </button>
    </div>
  )
}
