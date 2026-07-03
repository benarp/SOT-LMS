import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import ExportCsvButton, { type FinanceRow } from './ExportCsvButton'
import { BILLING_STATUS_LABELS, TOTAL_CYCLES, formatCents, outstandingCents } from '@/lib/billing'

const statusStyles: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  completed: 'bg-green-100 text-green-700',
}

export default async function FinancesPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: schoolYear } = await supabase
    .from('school_years').select('id, name').eq('is_active', true).single()

  const [{ data: students }, { data: accounts }] = await Promise.all([
    admin.from('profiles').select('id, full_name, email').eq('role', 'student').order('full_name'),
    schoolYear
      ? admin
          .from('billing_accounts')
          .select('student_id, status, deposit_paid, cycles_paid, total_collected_cents, credits_applied_cents, monthly_starts_at')
          .eq('school_year_id', schoolYear.id)
      : Promise.resolve({ data: [] }),
  ])

  const accountByStudent = new Map((accounts ?? []).map(a => [a.student_id, a]))

  const rows = (students ?? []).map(s => {
    const account = accountByStudent.get(s.id)
    const owed = account ? outstandingCents(account) : 0
    return {
      id: s.id,
      name: s.full_name || s.email || '—',
      email: s.email ?? '',
      status: account?.status ?? 'pending',
      depositPaid: account?.deposit_paid ?? false,
      collectedCents: account?.total_collected_cents ?? 0,
      outstandingCents: owed,
      cyclesPaid: account?.cycles_paid ?? 0,
    }
  })

  const count = (status: string) => rows.filter(r => r.status === status).length
  const totalCollected = rows.reduce((sum, r) => sum + r.collectedCents, 0)
  const totalOutstanding = rows.reduce((sum, r) => sum + r.outstandingCents, 0)
  const totalCredits = (accounts ?? []).reduce((sum, a) => sum + (a.credits_applied_cents ?? 0), 0)

  const csvRows: FinanceRow[] = rows.map(r => ({
    name: r.name,
    email: r.email,
    status: BILLING_STATUS_LABELS[r.status] ?? r.status,
    depositPaid: r.depositPaid ? 'Yes' : 'No',
    collected: (r.collectedCents / 100).toFixed(2),
    outstanding: (r.outstandingCents / 100).toFixed(2),
    cyclesPaid: `${r.cyclesPaid}/${TOTAL_CYCLES}`,
  }))

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Finances</h1>
          <p className="text-sm text-gray-400 mt-1">{schoolYear?.name ?? 'No active school year'}</p>
        </div>
        <ExportCsvButton rows={csvRows} yearName={schoolYear?.name ?? 'billing'} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total collected</p>
          <p className="text-2xl font-medium text-gray-900">{formatCents(totalCollected)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Outstanding</p>
          <p className={`text-2xl font-medium ${totalOutstanding > 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCents(totalOutstanding)}</p>
          <p className="text-xs text-gray-400 mt-0.5">across paused/overdue accounts</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Active</p>
          <p className="text-2xl font-medium text-gray-900">{count('active') + count('completed')}</p>
          <p className="text-xs text-gray-400 mt-0.5">{count('completed')} paid in full</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Needs attention</p>
          <p className="text-2xl font-medium text-gray-900">{count('overdue') + count('paused') + count('pending')}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {count('overdue')} overdue · {count('paused')} paused · {count('pending')} not started
          </p>
        </div>
      </div>

      {totalCredits > 0 && (
        <p className="text-xs text-gray-400 mb-6">{formatCents(totalCredits)} in scholarships/credits applied this year.</p>
      )}

      {/* Student-level table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Student</th>
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Status</th>
              <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">Deposit</th>
              <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Months</th>
              <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Collected</th>
              <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={i < rows.length - 1 ? 'border-b border-gray-50' : ''}>
                <td className="px-4 py-3">
                  <Link href={`/admin/students/${r.id}`} className="font-medium text-gray-900 hover:underline">{r.name}</Link>
                  <p className="text-xs text-gray-400">{r.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[r.status]}`}>
                    {BILLING_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">{r.depositPaid ? '✓' : <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-right text-gray-600">{r.cyclesPaid}/{TOTAL_CYCLES}</td>
                <td className="px-4 py-3 text-right text-gray-900">{formatCents(r.collectedCents)}</td>
                <td className="px-4 py-3 text-right">
                  {r.outstandingCents > 0
                    ? <span className="text-red-600 font-medium">{formatCents(r.outstandingCents)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">No students enrolled yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
