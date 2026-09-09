import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavShell from '@/components/NavShell'

export default async function LeaderLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, group_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'group_leader') redirect('/dashboard')

  const { data: group } = profile?.group_id
    ? await supabase.from('groups').select('name').eq('id', profile.group_id).single()
    : { data: null }

  const navItems = [
    {
      href: '/dashboard',
      label: 'This week',
      icon: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    },
    {
      href: '/dashboard/history',
      label: 'Curriculum',
      icon: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      href: '/leader',
      label: 'Group overview',
      icon: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
    {
      href: '/leader/students',
      label: 'Students',
      icon: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
  ]

  return (
    <NavShell
      title={group?.name ?? 'My Group'}
      subtitle="Group leader view"
      navItems={navItems}
      userInitials={(profile?.full_name || 'L').charAt(0).toUpperCase()}
      userName={profile?.full_name || ''}
      userRole="group_leader"
    >
      <div className="p-4 md:p-8">
        {children}
      </div>
    </NavShell>
  )
}
