import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const statusBadge: Record<string, { label: string; classes: string }> = {
  draft:     { label: 'In progress',   classes: 'bg-gray-100 text-gray-500' },
  submitted: { label: 'Under review',  classes: 'bg-blue-50 text-blue-600' },
  approved:  { label: 'Accepted',      classes: 'bg-green-50 text-green-700' },
  denied:    { label: 'Not accepted',  classes: 'bg-red-50 text-red-600' },
}

const refBadge: Record<string, { label: string; classes: string }> = {
  pending:   { label: '—',             classes: 'text-gray-300' },
  sent:      { label: 'Awaiting',      classes: 'text-yellow-600' },
  submitted: { label: 'Received',      classes: 'text-green-600' },
}

export default async function AdminApplicationsPage() {
  const supabase = await createClient()

  const { data: schoolYear } = await supabase.from('school_years').select('id, name').eq('is_active', true).single()

  const { data: applications } = schoolYear
    ? await supabase
        .from('applications')
        .select('id, status, full_name, submitted_at, profiles!applicant_id(email)')
        .eq('school_year_id', schoolYear.id)
        .order('submitted_at', { ascending: false, nullsFirst: false })
    : { data: [] }

  // Fetch reference statuses
  const appIds = (applications || []).map(a => a.id)
  const { data: refs } = appIds.length
    ? await supabase.from('pastoral_references').select('application_id, status').in('application_id', appIds)
    : { data: [] }

  const refMap: Record<string, string> = {}
  for (const r of refs || []) refMap[r.application_id] = r.status

  const counts = {
    total: (applications || []).length,
    submitted: (applications || []).filter(a => a.status === 'submitted').length,
    approved: (applications || []).filter(a => a.status === 'approved').length,
    denied: (applications || []).filter(a => a.status === 'denied').length,
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Applications</h1>
          <p className="text-sm text-gray-400 mt-1">{schoolYear?.name ?? 'No active school year'}</p>
        </div>
        <Link
          href="/admin/applications/settings"
          className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          Edit questions
        </Link>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total', value: counts.total },
          { label: 'Under review', value: counts.submitted },
          { label: 'Accepted', value: counts.approved },
          { label: 'Not accepted', value: counts.denied },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {(applications || []).length === 0 ? (
          <p className="text-sm text-gray-400 p-6">No applications yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Applicant</th>
                  <th className="text-left px-5 py-3 font-medium">Submitted</th>
                  <th className="text-left px-5 py-3 font-medium">Reference</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(applications || []).map(app => {
                  const profile = Array.isArray(app.profiles) ? app.profiles[0] : app.profiles
                  const email = (profile as { email?: string } | null)?.email ?? ''
                  const sb = statusBadge[app.status] ?? statusBadge.draft
                  const refStatus = refMap[app.id] ?? 'pending'
                  const rb = refBadge[refStatus] ?? refBadge.pending

                  return (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{app.full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{email}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {app.submitted_at
                          ? new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : <span className="text-gray-300">Not yet</span>}
                      </td>
                      <td className={`px-5 py-3 font-medium text-xs ${rb.classes}`}>{rb.label}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sb.classes}`}>
                          {sb.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/admin/applications/${app.id}`} className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2">
                          Review
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
