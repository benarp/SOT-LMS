import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import DecisionButtons from './DecisionButtons'
import Link from 'next/link'

const ESSAY_LABELS: Record<string, string> = {
  q_testimony: 'Testimony',
  q_why_attend: 'Why attend SOT?',
  q_goals: 'Goals for the program',
  q_serving: 'Current church involvement',
  q_additional: 'Additional notes',
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: app } = await supabase
    .from('applications')
    .select('*, profiles!applicant_id(email, full_name)')
    .eq('id', id)
    .single()

  if (!app) notFound()

  const { data: ref } = await supabase
    .from('pastoral_references')
    .select('*')
    .eq('application_id', id)
    .single()

  const profile = Array.isArray(app.profiles) ? app.profiles[0] : app.profiles
  const email = (profile as { email?: string } | null)?.email ?? ''

  const isDecided = app.status === 'approved' || app.status === 'denied'

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/applications" className="hover:text-gray-700">Applications</Link>
        <span>/</span>
        <span className="text-gray-600">{app.full_name}</span>
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{app.full_name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{email}</p>
            {app.phone && <p className="text-sm text-gray-400">{app.phone} {app.city && `· ${app.city}`}</p>}
          </div>
          <StatusBadge status={app.status} />
        </div>
        {app.submitted_at && (
          <p className="text-xs text-gray-400 mt-3">
            Submitted {new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        {isDecided && app.decision_notes && (
          <p className="text-sm text-gray-600 mt-3 bg-gray-50 rounded-lg p-3">{app.decision_notes}</p>
        )}
      </div>

      {/* Essay answers */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 mb-5 space-y-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Questionnaire</h2>
        {Object.entries(ESSAY_LABELS).map(([key, label]) => {
          const answer = app[key as keyof typeof app] as string | null
          if (!answer) return null
          return (
            <div key={key}>
              <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{answer}</p>
            </div>
          )
        })}
      </div>

      {/* Pastoral reference */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 mb-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Pastoral reference</h2>

        {!ref ? (
          <p className="text-sm text-gray-400">No reference on file.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{ref.pastor_name}</p>
                <p className="text-xs text-gray-400">{ref.pastor_email} {ref.pastor_church && `· ${ref.pastor_church}`}</p>
              </div>
              <RefStatusBadge status={ref.status} />
            </div>

            {ref.status === 'submitted' && (
              <div className="border-t border-gray-100 pt-4 space-y-4">
                {[
                  ['Relationship', ref.ref_relationship],
                  ['Character & faith maturity', ref.ref_character],
                  ['Recommendation', ref.ref_recommend],
                  ['Concerns', ref.ref_concerns],
                ].map(([label, value]) => value ? (
                  <div key={label as string}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Decision */}
      {!isDecided && app.status === 'submitted' && (
        <DecisionButtons applicationId={id} applicantName={app.full_name ?? ''} />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    draft:     { label: 'In progress',  classes: 'bg-gray-100 text-gray-500' },
    submitted: { label: 'Under review', classes: 'bg-blue-50 text-blue-600' },
    approved:  { label: 'Accepted',     classes: 'bg-green-50 text-green-700' },
    denied:    { label: 'Not accepted', classes: 'bg-red-50 text-red-600' },
  }
  const cfg = map[status] ?? map.draft
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.classes}`}>{cfg.label}</span>
}

function RefStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    pending:   { label: 'Not sent',  classes: 'bg-gray-100 text-gray-400' },
    sent:      { label: 'Awaiting',  classes: 'bg-yellow-50 text-yellow-600' },
    submitted: { label: 'Received',  classes: 'bg-green-50 text-green-700' },
  }
  const cfg = map[status] ?? map.pending
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.classes}`}>{cfg.label}</span>
}
