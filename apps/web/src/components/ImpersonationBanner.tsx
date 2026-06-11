'use client'

import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ImpersonationBanner({ studentName }: { studentName: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  if (!searchParams.get('impersonating')) return null

  async function handleExit() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
      <p className="text-sm text-amber-800">
        Viewing as <span className="font-medium">{studentName}</span>
      </p>
      <button
        onClick={handleExit}
        className="text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors border border-amber-300 rounded-lg px-2 py-1"
      >
        Exit — sign in as admin
      </button>
    </div>
  )
}
