import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const [{ count: studentCount }, { count: weekCount }, { data: recentSubmissions }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('weeks').select('*', { count: 'exact', head: true }).eq('school_year_id', schoolYear?.id || ''),
    supabase.from('submissions').select('completed_at').order('completed_at', { ascending: false }).limit(1),
  ])

  const stats = [
    { label: 'Students enrolled', value: studentCount ?? 0, href: '/admin/students' },
    { label: 'Weeks this year', value: weekCount ?? 0, href: '/admin/curriculum' },
    { label: 'Active school year', value: schoolYear?.name ?? 'None', href: '/admin/curriculum' },
  ]

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">Overview</h1>
        <p className="text-sm text-gray-400 mt-1">School of Transformation admin panel</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(stat => (
          <Link key={stat.label} href={stat.href} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
            <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
            <p className="text-xl font-medium text-gray-900">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: 'Curriculum', desc: 'Manage weeks and homework items', href: '/admin/curriculum', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
          { title: 'Students', desc: 'Invite and manage students', href: '/admin/students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
          { title: 'Reports', desc: 'Completion rates and late submissions', href: '/admin/reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
          { title: 'Announcements', desc: 'Post updates to students', href: '/admin/announcements', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
        ].map(item => (
          <Link key={item.title} href={item.href} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors group">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-400 mt-0.5 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
