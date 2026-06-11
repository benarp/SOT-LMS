import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditProfileForm from './EditProfileForm'
import RoleSelect from './RoleSelect'
import AccountActions from './AccountActions'
import GroupAssignSelect from '@/components/admin/GroupAssignSelect'
import ImpersonateButton from '@/components/admin/ImpersonateButton'

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: profile }, authUserResult, { data: application }, { data: schoolYear }] =
    await Promise.all([
      admin.from('profiles').select('id, full_name, email, role, group_id').eq('id', id).single(),
      admin.auth.admin.getUserById(id),
      admin.from('applications').select('phone, city').eq('applicant_id', id).maybeSingle(),
      supabase.from('school_years').select('id, name').eq('is_active', true).single(),
    ])

  if (!profile) notFound()

  const authUser = authUserResult.data?.user
  const bannedUntil = (authUser as { banned_until?: string } | undefined)?.banned_until
  const isDeactivated = !!bannedUntil && new Date(bannedUntil) > new Date()
  const lastSignIn = authUser?.last_sign_in_at

  // Groups for assignment + homework progress for the active year
  const [{ data: groups }, { data: weeks }] = await Promise.all([
    supabase.from('groups').select('id, name').eq('school_year_id', schoolYear?.id ?? '').order('name'),
    schoolYear
      ? supabase
          .from('weeks')
          .select('id, week_number, title, due_date, homework_items(id)')
          .eq('school_year_id', schoolYear.id)
          .order('week_number')
      : Promise.resolve({ data: [] as never[] }),
  ])

  const allItemIds = (weeks ?? []).flatMap(w => (w.homework_items ?? []).map((i: { id: string }) => i.id))
  const { data: submissions } = allItemIds.length
    ? await admin.from('submissions').select('homework_item_id').eq('student_id', id).in('homework_item_id', allItemIds)
    : { data: [] }
  const completedIds = new Set((submissions ?? []).map(s => s.homework_item_id))

  const groupName = (groups ?? []).find(g => g.id === profile.group_id)?.name

  return (
    <div className="max-w-4xl">
      <Link href="/admin/students" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
        ← All users
      </Link>

      <div className="mt-4 mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{profile.full_name || profile.email}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {profile.email}
            {groupName ? ` · ${groupName}` : ''}
            {lastSignIn
              ? ` · last signed in ${new Date(lastSignIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : ' · never signed in'}
          </p>
          {isDeactivated && (
            <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
              Deactivated
            </span>
          )}
        </div>
        {profile.role === 'student' && !isDeactivated && (
          <ImpersonateButton email={profile.email} name={profile.full_name || profile.email} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Profile</h2>
            <EditProfileForm
              userId={profile.id}
              initialName={profile.full_name ?? ''}
              initialEmail={profile.email}
            />
            {(application?.phone || application?.city) && (
              <p className="text-xs text-gray-400 mt-3">
                From application: {[application.phone, application.city].filter(Boolean).join(' · ')}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Role & group</h2>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">Role</span>
                <RoleSelect userId={profile.id} currentRole={profile.role} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">Group</span>
                <GroupAssignSelect
                  studentId={profile.id}
                  currentGroupId={profile.group_id}
                  groups={groups ?? []}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Account</h2>
            <AccountActions
              userId={profile.id}
              isDeactivated={isDeactivated}
              hasSignedIn={!!lastSignIn}
            />
          </section>
        </div>

        <section>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Homework — {schoolYear?.name ?? 'no active year'}
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
            {(weeks ?? []).map(week => {
              const itemIds = (week.homework_items ?? []).map((i: { id: string }) => i.id)
              const completed = itemIds.filter(itemId => completedIds.has(itemId)).length
              const total = itemIds.length
              const pastDue = new Date(week.due_date) < new Date()
              const status =
                total === 0 ? null : completed >= total ? 'done' : pastDue ? 'late' : 'open'
              return (
                <div key={week.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      Week {week.week_number} — {week.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      Due {new Date(week.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500">{completed}/{total}</span>
                    {status === 'done' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Complete</span>
                    )}
                    {status === 'late' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Incomplete</span>
                    )}
                  </div>
                </div>
              )
            })}
            {(weeks ?? []).length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No weeks in the active school year.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
