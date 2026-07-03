'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { pausePayments, resumePayments, applyCredit, cancelBilling, issueRefund } from '@/app/actions/billing'
import { BILLING_STATUS_LABELS } from '@/lib/billing'

type Account = {
  id: string
  status: string
  deposit_paid: boolean
  cycles_paid: number
  total_collected_cents: number
  credits_applied_cents: number
  outstanding_cents: number
}

type BillingEvent = {
  id: string
  type: string
  amount_cents: number | null
  stripe_object_id: string | null
  notes: string | null
  created_at: string
}

const eventLabels: Record<string, string> = {
  deposit_paid: 'Deposit paid',
  payment_succeeded: 'Payment received',
  payment_failed: 'Payment failed',
  paused: 'Payments paused',
  resumed: 'Payments resumed',
  credit_applied: 'Credit applied',
  cancelled: 'Billing cancelled',
  completed: 'Paid in full',
  refund_issued: 'Refund issued',
}

const statusStyles: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  completed: 'bg-green-100 text-green-700',
}

function dollars(cents: number | null): string {
  if (cents == null) return ''
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export default function BillingPanel({ account, events }: { account: Account | null; events: BillingEvent[] }) {
  const [mode, setMode] = useState<'none' | 'credit' | 'refund'>('none')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  if (!account) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-400">
          No billing account yet — it&apos;s created when the student starts payment setup from their Tuition page.
        </p>
      </div>
    )
  }

  function run(fn: () => Promise<{ error?: string }>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setError(''); setNotice('')
    startTransition(async () => {
      const result = await fn()
      if (result.error) setError(result.error)
      else { setNotice('Done.'); setMode('none'); router.refresh() }
    })
  }

  const refundableEvents = events.filter(e =>
    (e.type === 'deposit_paid' || e.type === 'payment_succeeded') && e.stripe_object_id)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Status</span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles[account.status]}`}>
          {BILLING_STATUS_LABELS[account.status]}
        </span>
      </div>

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-gray-400">Deposit</dt><dd className="text-gray-900">{account.deposit_paid ? 'Paid' : 'Not paid'}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">Months paid</dt><dd className="text-gray-900">{account.cycles_paid} of 10</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">Collected</dt><dd className="text-gray-900">{dollars(account.total_collected_cents)}</dd></div>
        {account.credits_applied_cents > 0 && (
          <div className="flex justify-between"><dt className="text-gray-400">Credits</dt><dd className="text-gray-900">{dollars(account.credits_applied_cents)}</dd></div>
        )}
        {account.outstanding_cents > 0 && (
          <div className="flex justify-between"><dt className="text-gray-400">Outstanding</dt><dd className="text-red-600 font-medium">{dollars(account.outstanding_cents)}</dd></div>
        )}
      </dl>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        {account.status === 'active' || account.status === 'overdue' ? (
          <button onClick={() => run(() => pausePayments(account.id), 'Pause payments? No further charges until resumed; the balance owed keeps accruing.')} disabled={pending}
            className="text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 disabled:opacity-50">Pause</button>
        ) : null}
        {account.status === 'paused' && (
          <button onClick={() => run(() => resumePayments(account.id))} disabled={pending}
            className="text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 disabled:opacity-50">Resume</button>
        )}
        {account.status !== 'pending' && account.status !== 'cancelled' && (
          <button onClick={() => setMode(mode === 'credit' ? 'none' : 'credit')} disabled={pending}
            className="text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 disabled:opacity-50">Apply credit</button>
        )}
        {refundableEvents.length > 0 && (
          <button onClick={() => setMode(mode === 'refund' ? 'none' : 'refund')} disabled={pending}
            className="text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 disabled:opacity-50">Refund</button>
        )}
        {account.status !== 'pending' && account.status !== 'cancelled' && account.status !== 'completed' && (
          <button onClick={() => run(() => cancelBilling(account.id), 'Cancel all future billing for this student? This does not issue a refund.')} disabled={pending}
            className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50">Cancel billing</button>
        )}
      </div>

      {/* Credit form */}
      {mode === 'credit' && (
        <form className="bg-gray-50 rounded-lg p-3 space-y-2" onSubmit={e => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          run(() => applyCredit(account.id, parseFloat(fd.get('amount') as string), fd.get('notes') as string))
        }}>
          <input name="amount" type="number" min="1" step="0.01" required placeholder="Amount in dollars (e.g. 200)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <input name="notes" required placeholder='Note, e.g. "Merit scholarship — approved by Ben"'
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <button type="submit" disabled={pending} className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
            {pending ? 'Applying…' : 'Apply credit'}
          </button>
        </form>
      )}

      {/* Refund form */}
      {mode === 'refund' && (
        <form className="bg-gray-50 rounded-lg p-3 space-y-2" onSubmit={e => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          run(() => issueRefund(account.id, fd.get('charge') as string, parseFloat(fd.get('amount') as string)))
        }}>
          <select name="charge" required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
            <option value="">Select the charge to refund…</option>
            {refundableEvents.map(e => (
              <option key={e.id} value={e.stripe_object_id!}>
                {eventLabels[e.type]} — {dollars(e.amount_cents)} on {new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </option>
            ))}
          </select>
          <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Refund amount in dollars (partial OK)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <button type="submit" disabled={pending} className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
            {pending ? 'Refunding…' : 'Issue refund'}
          </button>
        </form>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {notice && !error && <p className="text-xs text-green-600">{notice}</p>}

      {/* History */}
      {events.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Payment history</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {events.map(e => (
              <div key={e.id} className="flex items-baseline justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className={e.type === 'payment_failed' ? 'text-red-600' : 'text-gray-700'}>
                    {eventLabels[e.type] ?? e.type}
                  </span>
                  {e.notes && <span className="text-gray-400"> · {e.notes}</span>}
                </div>
                <div className="shrink-0 text-gray-400">
                  {e.amount_cents != null && <span className="mr-2 text-gray-600">{dollars(e.amount_cents)}</span>}
                  {new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
