import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { getImpersonationState } from '@/app/actions/impersonate'
import NavShell from '@/components/NavShell'
import Link from 'next/link'
import { BILLING_VISIBLE_TO_STUDENTS } from '@/lib/billing'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const impersonation = await getImpersonationState()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  // Group leaders reach This week and Curriculum so they can see the work
  // their students were assigned. They still land on /leader when they sign
  // in (see proxy.ts); the group links below keep that a click away.
  const isGroupLeader = profile?.role === 'group_leader'

  const initials = (profile?.full_name || user.email || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

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
    // Tuition stays hidden until Stripe is finished — admins keep it so they
    // can still see the student-facing view.
    ...(BILLING_VISIBLE_TO_STUDENTS || profile?.role === 'admin' ? [{
      href: '/dashboard/billing',
      label: 'Tuition',
      icon: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    }] : []),
    ...(isGroupLeader ? [{
      href: '/leader',
      label: 'Group overview',
      icon: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    }, {
      href: '/leader/students',
      label: 'Students',
      icon: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    }] : []),
    {
      href: '/dashboard/account',
      label: 'Account',
      icon: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    },
    ...(profile?.role === 'admin' ? [{
      href: '/admin',
      label: 'Admin panel',
      icon: <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    }] : []),
  ]

  return (
    <NavShell
      title="School of Transformation"
      subtitle="Discipleship Training"
      navItems={navItems}
      userInitials={initials}
      userName={profile?.full_name || user.email || ''}
      userRole={profile?.role || 'student'}
    >
      {impersonation && (
        <ImpersonationBanner studentName={impersonation.studentName || profile?.full_name || user.email || 'student'} />
      )}
      <div className="p-4 md:p-8">
        {children}
      </div>
    </NavShell>
  )
}
