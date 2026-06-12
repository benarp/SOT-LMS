import { createClient } from '@/lib/supabase/server'
import { getApplicationCycle } from '@/lib/applicationYear'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const statusConfig = {
  draft: { label: 'In progress', color: 'text-gray-500', bg: 'bg-gray-100' },
  submitted: { label: 'Under review', color: 'text-blue-600', bg: 'bg-blue-50' },
  approved: { label: 'Accepted', color: 'text-green-700', bg: 'bg-green-50' },
  denied: { label: 'Not accepted', color: 'text-red-600', bg: 'bg-red-50' },
}

export default async function ApplicationStatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/apply/account')

  const { year: schoolYear } = await getApplicationCycle()
  if (!schoolYear) redirect('/apply')

  const { data: app } = await supabase
    .from('applications')
    .select('id, status, full_name, submitted_at, decided_at, decision_notes, q_testimony, agreement_accepted')
    .eq('school_year_id', schoolYear.id)
    .eq('applicant_id', user.id)
    .single()

  if (!app) redirect('/apply/questionnaire')

  const { data: ref } = await supabase
    .from('pastoral_references')
    .select('pastor_name, pastor_email, status')
    .eq('application_id', app.id)
    .single()

  const step1Done = !!app.q_testimony && !!app.agreement_accepted
  const cfg = statusConfig[app.status as keyof typeof statusConfig] ?? statusConfig.draft

  return (
    <div className="space-y-4">
      {/* Overall status */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Your application</h2>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-sm text-gray-400">{schoolYear.name}</p>

        {app.submitted_at && (
          <p className="text-xs text-gray-400 mt-2">
            Submitted {new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}

        {app.status === 'approved' && (
          <div className="mt-4 p-4 bg-green-50 rounded-xl">
            <p className="text-sm font-medium text-green-800 mb-1">Congratulations!</p>
            <p className="text-sm text-green-700">
              Your application has been accepted. Check your email for next steps.
            </p>
            {app.decision_notes && <p className="text-sm text-green-700 mt-2">{app.decision_notes}</p>}
          </div>
        )}

        {app.status === 'denied' && (
          <div className="mt-4 p-4 bg-red-50 rounded-xl">
            <p className="text-sm text-red-700">
              Thank you for applying. We're not able to offer you a spot this year.
              {app.decision_notes && ` ${app.decision_notes}`}
            </p>
          </div>
        )}
      </div>

      {/* Step checklist */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Application steps</h3>

        <StepRow
          number={1}
          label="Questionnaire"
          done={step1Done}
          pending={!step1Done}
          action={!step1Done ? <Link href="/apply/questionnaire" className="text-xs text-gray-900 underline">Continue →</Link> : null}
        />

        <StepRow
          number={2}
          label="Pastoral reference"
          done={ref?.status === 'submitted'}
          pending={!ref}
          waiting={ref?.status === 'sent'}
          detail={
            ref?.status === 'sent'
              ? `Waiting for ${ref.pastor_name} (${ref.pastor_email})`
              : ref?.status === 'submitted'
              ? `Received from ${ref.pastor_name}`
              : undefined
          }
          action={!ref && step1Done ? <Link href="/apply/reference" className="text-xs text-gray-900 underline">Add reference →</Link> : null}
        />
      </div>
    </div>
  )
}

function StepRow({
  number, label, done, pending, waiting, detail, action,
}: {
  number: number
  label: string
  done?: boolean
  pending?: boolean
  waiting?: boolean
  detail?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium
        ${done ? 'bg-green-500 text-white' : waiting ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}
      >
        {done ? (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium ${done ? 'text-gray-900' : 'text-gray-500'}`}>{label}</p>
          {action}
        </div>
        {detail && <p className="text-xs text-gray-400 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}
