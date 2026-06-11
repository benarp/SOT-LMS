import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ApplicationSettingsForm from './ApplicationSettingsForm'

const DEFAULTS = {
  q_testimony_label: 'Share your testimony',
  q_testimony_hint: 'How did you come to faith, and what has your journey with Jesus looked like?',
  q_why_attend_label: 'Why do you want to attend the School of Transformation this year?',
  q_why_attend_hint: '',
  q_goals_label: 'What are you hoping God will do in your life through this program?',
  q_goals_hint: '',
  q_serving_label: 'Are you currently involved in a local church?',
  q_serving_hint: "If so, describe how you're serving.",
  q_additional_label: 'Is there anything else you\'d like us to know?',
  q_additional_hint: 'Optional.',
  agreement_text:
    'I understand that School of Transformation is a 9-month commitment running September through May. I agree to attend weekly sessions and complete assignments to the best of my ability. I understand there is a cost associated with the program.',
}

export default async function ApplicationSettingsPage() {
  const supabase = await createClient()

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const { data: settings } = schoolYear
    ? await supabase
        .from('application_settings')
        .select('*')
        .eq('school_year_id', schoolYear.id)
        .single()
    : { data: null }

  const values = { ...DEFAULTS, ...(settings || {}) }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/applications" className="hover:text-gray-700">Applications</Link>
        <span>/</span>
        <span className="text-gray-600">Questions</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Application questions</h1>
        <p className="text-sm text-gray-400 mt-1">
          {schoolYear?.name ?? 'No active school year'} · Changes apply to new submissions immediately.
        </p>
      </div>

      <ApplicationSettingsForm values={values} />
    </div>
  )
}
