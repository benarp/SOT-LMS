import { createClient } from '@/lib/supabase/server'
import { getApplicationCycle } from '@/lib/applicationYear'
import { redirect } from 'next/navigation'
import QuestionnaireForm from '../questionnaire/QuestionnaireForm'
import { submitWellnessSurvey } from '@/app/actions/applicationForm'
import type { AppField, AnswerMap } from '@/lib/applicationForm'

export default async function WellnessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/apply/account')

  const { year: schoolYear } = await getApplicationCycle()
  if (!schoolYear) redirect('/apply')

  const { data: app } = await supabase
    .from('applications')
    .select('id, status, wellness_submitted_at, wellness_honesty_acknowledged_at')
    .eq('school_year_id', schoolYear.id)
    .eq('applicant_id', user.id)
    .single()

  if (!app) redirect('/apply/questionnaire')

  // Unlocks once the app reaches the interview stage (after reference is in);
  // already-submitted wellness surveys belong on the status page, not here.
  if (app.status !== 'interview' || app.wellness_submitted_at) {
    redirect('/apply/status')
  }

  const [{ data: fields }, { data: answerRows }] = await Promise.all([
    supabase.from('application_fields').select('*').eq('school_year_id', schoolYear.id).eq('form_key', 'wellness').order('sort_order', { ascending: true }),
    supabase.from('application_answers').select('field_id, value').eq('application_id', app.id),
  ])

  const answers: AnswerMap = {}
  for (const row of answerRows ?? []) answers[row.field_id] = row.value as string | string[]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Health & Wellness Survey</h1>
        <p className="text-sm text-gray-500 mt-1">
          This provides a framework for your in-person interview. We care about your physical, emotional,
          mental, relational, and spiritual health — please answer honestly and completely.
        </p>
      </div>

      <QuestionnaireForm
        fields={(fields ?? []) as AppField[]}
        initialAnswers={answers}
        contact={{
          full_name: '', phone: '', date_of_birth: '', gender: '',
          address_line1: '', address_line2: '', city: '', address_region: '', address_postal_code: '', address_country: '',
          profile_photo_name: '',
        }}
        schoolYearName={schoolYear.name}
        formKey="wellness"
        onSubmit={submitWellnessSurvey}
        afterSubmitPath="/apply/status"
        initialHonestyAcknowledged={!!app.wellness_honesty_acknowledged_at}
      />
    </div>
  )
}
