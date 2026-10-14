import { Suspense } from 'react'
import { loadReflectionsFeed } from '@/lib/reflectionsFeed'
import ReflectionsFeed from '@/components/ReflectionsFeed'

export default async function ReflectionsPage() {
  const { schoolYearName, reflections, weeks, groups, students } = await loadReflectionsFeed({ includeContacts: true })

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
          canSaveRotation
        />
      </Suspense>
    </div>
  )
}
