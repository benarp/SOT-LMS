import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadReflectionsFeed } from '@/lib/reflectionsFeed'
import ReflectionsFeed from '@/components/ReflectionsFeed'

export default async function LeaderReflectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('group_id')
    .eq('id', user.id)
    .single()

  if (!profile?.group_id) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-medium text-gray-900">Reflections</h1>
        <p className="mt-4 text-sm text-gray-400">You haven&apos;t been assigned to a group yet. Contact your admin.</p>
      </div>
    )
  }

  // Phone numbers stay admin-only (see migration-profile-contact-fields.sql).
  const { schoolYearName, reflections, weeks, groups, students } = await loadReflectionsFeed({
    groupId: profile.group_id,
    includeContacts: false,
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Reflections</h1>
        <p className="text-sm text-gray-400 mt-1">{schoolYearName} · newest first</p>
      </div>

      <Suspense fallback={<p className="text-sm text-gray-400">Loading reflections…</p>}>
        <ReflectionsFeed
          reflections={reflections}
          weeks={weeks}
          groups={groups}
          students={students}
          canSaveRotation={false}
        />
      </Suspense>
    </div>
  )
}
