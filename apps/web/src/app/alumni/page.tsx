import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'

export default async function AlumniPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, alumni_year_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'alumni') redirect('/dashboard')

  const { data: year } = profile.alumni_year_id
    ? await supabase.from('school_years').select('name').eq('id', profile.alumni_year_id).single()
    : { data: null }

  // Their written reflection responses, joined to the homework item title
  const { data: reflections } = await supabase
    .from('submissions')
    .select('id, response_text, completed_at, homework_items(title)')
    .eq('student_id', user.id)
    .not('response_text', 'is', null)
    .order('completed_at', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">School of Transformation</h1>
          <p className="text-xs text-gray-400">Alumni{year ? ` — ${year.name}` : ''}</p>
        </div>
        <SignOutButton />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-medium text-gray-900">
          {profile.full_name ? `Welcome back, ${profile.full_name.split(' ')[0]}` : 'Welcome back'}
        </h2>
        <p className="text-sm text-gray-500 mt-2 mb-8">
          Your year at the School of Transformation is complete. The reflections you wrote are kept
          here for you.
        </p>

        <div className="space-y-4">
          {(reflections ?? []).map(r => {
            const item = r.homework_items as unknown as { title: string } | null
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-6">
                <p className="text-sm font-semibold text-gray-900">{item?.title ?? 'Untitled reflection'}</p>
                <p className="text-sm text-gray-700 mt-4 whitespace-pre-line leading-relaxed">{r.response_text}</p>
                <p className="text-xs text-gray-300 mt-4">
                  Written {new Date(r.completed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )
          })}
          {(reflections ?? []).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">No reflections on record.</p>
          )}
        </div>
      </main>
    </div>
  )
}
