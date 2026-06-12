import { createClient } from '@/lib/supabase/server'
import { getApplicationCycle } from '@/lib/applicationYear'
import { redirect } from 'next/navigation'
import PastorReferenceForm from './PastorReferenceForm'

export default async function ReferencePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/apply/account')

  const { year: schoolYear } = await getApplicationCycle()
  if (!schoolYear) redirect('/apply')

  const { data: app } = await supabase
    .from('applications')
    .select('id, status, full_name, q_testimony, agreement_accepted')
    .eq('school_year_id', schoolYear.id)
    .eq('applicant_id', user.id)
    .single()

  if (!app) redirect('/apply/questionnaire')

  // Check step 1 is complete
  const step1Done = !!app.q_testimony && !!app.agreement_accepted
  if (!step1Done) redirect('/apply/questionnaire')

  // If approved/denied, go to status
  if (app.status === 'approved' || app.status === 'denied') redirect('/apply/status')

  const { data: ref } = await supabase
    .from('pastoral_references')
    .select('pastor_name, pastor_email, pastor_church, status')
    .eq('application_id', app.id)
    .single()

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-sm text-gray-500">Questionnaire</span>
        </div>
        <div className="flex-1 h-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-medium">2</div>
          <span className="text-sm font-medium text-gray-900">Pastoral reference</span>
        </div>
      </div>

      <PastorReferenceForm existingRef={ref} applicationStatus={app.status} />
    </div>
  )
}
