import { createClient } from '@/lib/supabase/server'
import CreateSchoolYearForm from './CreateSchoolYearForm'
import SchoolYearCard from './SchoolYearCard'
import ThemeToggle from '@/components/ThemeToggle'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: schoolYears } = await supabase
    .from('school_years')
    .select('id, name, start_date, end_date, is_active, applications_open_at, applications_close_at, completed_at')
    .order('start_date', { ascending: false, nullsFirst: false })

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage school years and application windows.</p>
      </div>

      {/* Appearance */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Appearance</h2>
        <p className="text-xs text-gray-400 mb-4">Theme for this device. &ldquo;System&rdquo; follows your device settings.</p>
        <ThemeToggle />
      </div>

      {/* School years list */}
      <h2 className="text-sm font-medium text-gray-700 mb-3">School years</h2>
      <div className="space-y-3 mb-8">
        {(schoolYears || []).map(year => (
          <SchoolYearCard key={year.id} year={year} />
        ))}
        {(schoolYears || []).length === 0 && (
          <p className="text-sm text-gray-400">No school years yet.</p>
        )}
      </div>

      {/* Create new */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Create school year</h2>
        <CreateSchoolYearForm />
      </div>
    </div>
  )
}
