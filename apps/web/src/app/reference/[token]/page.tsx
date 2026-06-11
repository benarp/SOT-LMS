import { createAdminClient } from '@/lib/supabase/admin'
import PastorForm from './PastorForm'

export default async function PastorReferencePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: ref } = await admin
    .from('pastoral_references')
    .select('id, status, pastor_name, application_id, applications(full_name)')
    .eq('token', token)
    .single()

  if (!ref) {
    return (
      <PageShell>
        <p className="text-gray-500 text-center">This reference link is invalid or has expired.</p>
      </PageShell>
    )
  }

  if (ref.status === 'submitted') {
    return (
      <PageShell>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Reference submitted</h2>
          <p className="text-sm text-gray-500">Thank you — we've already received your reference for this applicant.</p>
        </div>
      </PageShell>
    )
  }

  const app = Array.isArray(ref.applications) ? ref.applications[0] : ref.applications
  const applicantName = (app as { full_name?: string } | null)?.full_name ?? 'the applicant'

  return (
    <PageShell>
      <div className="mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">School of Transformation</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Pastoral Reference</h1>
        <p className="text-sm text-gray-500">
          You've been asked to provide a reference for <strong>{applicantName}</strong>.
          This should take about 5 minutes.
        </p>
      </div>
      <PastorForm token={token} pastorName={ref.pastor_name ?? ''} applicantName={applicantName} />
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-xl">{children}</div>
    </div>
  )
}
