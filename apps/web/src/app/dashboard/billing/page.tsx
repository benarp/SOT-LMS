import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StartCheckoutButton, UpdateCardButton } from '@/components/BillingActions'
import {
  BILLING_STATUS_LABELS, BILLING_EVENT_LABELS, DEPOSIT_CENTS, MONTHLY_CENTS, TOTAL_CYCLES,
  formatCents, outstandingCents, nextPaymentDate, finalPaymentDate, remainingCents,
} from '@/lib/billing'

type BillingEvent = {
  id: string
  type: string
  amount_cents: number | null
  notes: string | null
  payment_method: string | null
  received_by: string | null
  paid_at: string | null
  created_at: string
}

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const fmtShortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const statusStyles: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  completed: 'bg-green-100 text-green-700',
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { setup } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: year } = await supabase
    .from('school_years').select('id, name').eq('is_active', true).single()

  const { data: account } = year ? await supabase
    .from('billing_accounts')
    .select('id, status, deposit_paid, cycles_paid, total_collected_cents, credits_applied_cents, monthly_starts_at')
    .eq('student_id', user.id)
    .eq('school_year_id', year.id)
    .maybeSingle() : { data: null }

  const { data: events } = account ? await supabase
    .from('billing_events')
    .select('id, type, amount_cents, notes, payment_method, received_by, paid_at, created_at')
    .eq('billing_account_id', account.id)
    .order('created_at', { ascending: false }) : { data: [] as BillingEvent[] }

  const status = account?.status ?? 'pending'
  const owed = account ? outstandingCents(account) : 0
  const nextPayment = account ? nextPaymentDate(account) : null
  const finalPayment = account ? finalPaymentDate(account.monthly_starts_at) : null
  const remaining = account ? remainingCents(account) : 0

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Tuition</h1>
        <p className="text-sm text-gray-400 mt-1">{year?.name ?? 'No active school year'}</p>
      </div>

      {setup === 'success' && (
        <div className="mb-6 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">
          Payment set up successfully. Your deposit has been received — thank you!
        </div>
      )}
      {setup === 'cancelled' && (
        <div className="mb-6 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
          Checkout was cancelled. You can restart it any time below.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-700">Payment status</p>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles[status]}`}>
            {BILLING_STATUS_LABELS[status]}
          </span>
        </div>

        {status === 'pending' ? (
          <>
            <p className="text-sm text-gray-500 leading-relaxed mb-1">
              Tuition is <strong>{formatCents(DEPOSIT_CENTS + MONTHLY_CENTS * TOTAL_CYCLES)}</strong> for the year:
              a {formatCents(DEPOSIT_CENTS)} deposit today, then {formatCents(MONTHLY_CENTS)}/month
              for {TOTAL_CYCLES} months starting about a month from now.
            </p>
            <p className="text-xs text-gray-400 mb-5">Payments are processed securely by Stripe.</p>
            <StartCheckoutButton />
          </>
        ) : (
          <>
            <dl className="space-y-2 text-sm mb-5">
              <div className="flex justify-between">
                <dt className="text-gray-400">Deposit</dt>
                <dd className="text-gray-900">{account?.deposit_paid ? 'Paid' : 'Not paid'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Monthly payments</dt>
                <dd className="text-gray-900">{account?.cycles_paid ?? 0} of {TOTAL_CYCLES} paid ({formatCents(MONTHLY_CENTS)} each)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Total paid</dt>
                <dd className="text-gray-900">{formatCents(account?.total_collected_cents ?? 0)}</dd>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Remaining this year</dt>
                  <dd className="text-gray-900">{formatCents(remaining)}</dd>
                </div>
              )}
              {nextPayment && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Next payment</dt>
                  <dd className="text-gray-900">{formatCents(MONTHLY_CENTS)} on {fmtDate(nextPayment)}</dd>
                </div>
              )}
              {finalPayment && status !== 'completed' && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Final payment</dt>
                  <dd className="text-gray-900">{fmtDate(finalPayment)}</dd>
                </div>
              )}
              {owed > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Balance due</dt>
                  <dd className="text-red-600 font-medium">{formatCents(owed)}</dd>
                </div>
              )}
            </dl>
            {status === 'paused' && (
              <p className="text-sm text-amber-600 mb-4">
                Your payments are paused. Contact the school office about resuming.
              </p>
            )}
            {status === 'overdue' && (
              <p className="text-sm text-red-600 mb-4">
                Your last payment didn&apos;t go through. Please update your card below — Stripe will retry automatically.
              </p>
            )}
            {(status === 'active' || status === 'overdue' || status === 'paused') && <UpdateCardButton />}
          </>
        )}
      </div>

      {events && events.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Payment history</p>
          <div className="space-y-2">
            {events.map(e => (
              <div key={e.id} className="flex items-baseline justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className={e.type === 'payment_failed' ? 'text-red-600' : 'text-gray-700'}>
                    {BILLING_EVENT_LABELS[e.type] ?? e.type}
                  </span>
                  {e.type === 'offline_payment' && (
                    <span className="text-gray-400">
                      {' · '}{e.payment_method === 'cash' ? 'Cash' : 'Check'}
                    </span>
                  )}
                  {e.notes && <span className="text-gray-400"> · {e.notes}</span>}
                </div>
                <div className="shrink-0 text-gray-400">
                  {e.amount_cents != null && <span className="mr-2 text-gray-600">{formatCents(e.amount_cents)}</span>}
                  {fmtShortDate((e.type === 'offline_payment' && e.paid_at) ? e.paid_at : e.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 leading-relaxed">
        Questions about your tuition, pauses, or refunds? Contact the school director — billing changes
        are handled by the school office.
      </p>
    </div>
  )
}
