import { createAdminClient } from '@/lib/supabase/admin'
import { getApplicationCycle } from '@/lib/applicationYear'
import Link from 'next/link'
import FormBuilder from './FormBuilder'
import type { AppField } from '@/lib/applicationForm'

export default async function ApplicationSettingsPage() {
  const { year: schoolYear } = await getApplicationCycle()
  const admin = createAdminClient()

  const { data: fields } = schoolYear
    ? await admin
        .from('application_fields')
        .select('*')
        .eq('school_year_id', schoolYear.id)
        .order('sort_order', { ascending: true })
    : { data: [] }

  // Per-field answer counts (drives the "N answers" note + delete blocking UX)
  const fieldIds = (fields ?? []).map(f => f.id)
  const { data: answerRows } = fieldIds.length
    ? await admin.from('application_answers').select('field_id').in('field_id', fieldIds)
    : { data: [] }
  const counts = new Map<string, number>()
  for (const row of answerRows ?? []) counts.set(row.field_id, (counts.get(row.field_id) ?? 0) + 1)

  const withCounts = ((fields ?? []) as AppField[]).map(f => ({ ...f, answer_count: counts.get(f.id) ?? 0 }))

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/applications" className="hover:text-gray-700">Applications</Link>
        <span>/</span>
        <span className="text-gray-600">Form builder</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Application form</h1>
        <p className="text-sm text-gray-400 mt-1">
          {schoolYear?.name ?? 'No application cycle configured'} · Section headers split the
          form into steps for applicants. Changes apply immediately.
        </p>
      </div>

      {schoolYear ? (
        <FormBuilder fields={withCounts} schoolYearId={schoolYear.id} />
      ) : (
        <p className="text-sm text-gray-400">Set an application window on a school year first (Settings).</p>
      )}
    </div>
  )
}
