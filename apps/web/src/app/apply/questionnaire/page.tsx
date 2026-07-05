import { createClient } from '@/lib/supabase/server'
import { getApplicationCycle } from '@/lib/applicationYear'
import { redirect } from 'next/navigation'
import QuestionnaireForm from './QuestionnaireForm'
import type { AppField, AnswerMap } from '@/lib/applicationForm'

export default async function QuestionnairePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/apply/account')

  const { year: schoolYear } = await getApplicationCycle()
  if (!schoolYear) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-gray-500">Applications are not open yet. Check back soon.</p>
      </div>
    )
  }

  const [{ data: app }, { data: fields }] = await Promise.all([
    supabase.from('applications').select('id, status, full_name, phone, city').eq('school_year_id', schoolYear.id).eq('applicant_id', user.id).single(),
    supabase.from('application_fields').select('*').eq('school_year_id', schoolYear.id).order('sort_order', { ascending: true }),
  ])

  // Anything past draft (reference stage onward) belongs on the status page
  if (app && app.status !== 'draft') {
    redirect('/apply/status')
  }

  const { data: answerRows } = app
    ? await supabase.from('application_answers').select('field_id, value').eq('application_id', app.id)
    : { data: [] }
  const answers: AnswerMap = {}
  for (const row of answerRows ?? []) answers[row.field_id] = row.value as string | string[]

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-medium">1</div>
          <span className="text-sm font-medium text-gray-900">Questionnaire</span>
        </div>
        <div className="flex-1 h-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center font-medium">2</div>
          <span className="text-sm text-gray-400">Pastoral reference</span>
        </div>
      </div>

      <QuestionnaireForm
        fields={(fields ?? []) as AppField[]}
        initialAnswers={answers}
        contact={{ full_name: app?.full_name ?? '', phone: app?.phone ?? '', city: app?.city ?? '' }}
        schoolYearName={schoolYear.name}
      />
    </div>
  )
}
