import { createClient } from '@/lib/supabase/server'
import { getApplicationCycle } from '@/lib/applicationYear'
import { redirect } from 'next/navigation'
import QuestionnaireForm from './QuestionnaireForm'

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

  const [{ data: app }, { data: settings }] = await Promise.all([
    supabase.from('applications').select('*').eq('school_year_id', schoolYear.id).eq('applicant_id', user.id).single(),
    supabase.from('application_settings').select('*').eq('school_year_id', schoolYear.id).single(),
  ])

  // If already submitted, redirect to status
  if (app?.status === 'submitted' || app?.status === 'approved' || app?.status === 'denied') {
    redirect('/apply/status')
  }

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

      <QuestionnaireForm existing={app} settings={settings} schoolYearName={schoolYear.name} />
    </div>
  )
}
