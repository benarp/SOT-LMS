import Link from 'next/link'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, formatCents } from '@/lib/billing'
import ExportSubscriptionsButton, { type SubscriptionRow } from './ExportSubscriptionsButton'

// Live Stripe data — never serve this from cache.
export const dynamic = 'force-dynamic'

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  unpaid: 'bg-red-100 text-red-700',
  incomplete: 'bg-amber-100 text-amber-700',
  incomplete_expired: 'bg-gray-100 text-gray-500',
  canceled: 'bg-gray-100 text-gray-500',
  paused: 'bg-amber-100 text-amber-700',
}

function formatDate(unix: number | null | undefined): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Per-period total across all items on the subscription, and the cadence it
 * bills on. Metered/tiered prices have no unit_amount, so they're reported as
 * unknown rather than silently counted as $0.
 */
function describeAmount(sub: Stripe.Subscription): { amountCents: number | null; interval: string } {
  let total = 0
  let unknown = false
  let interval = '—'

  for (const item of sub.items.data) {
    const price = item.price
    if (price.unit_amount == null) {
      unknown = true
    } else {
      total += price.unit_amount * (item.quantity ?? 1)
    }
    if (price.recurring) {
      const count = price.recurring.interval_count
      interval = count > 1 ? `every ${count} ${price.recurring.interval}s` : `per ${price.recurring.interval}`
    }
  }

  return { amountCents: unknown ? null : total, interval }
}

/**
 * current_period_end moved from the subscription to its items in recent Stripe
 * API versions — read whichever this account's version provides.
 */
function periodEnd(sub: Stripe.Subscription): number | null {
  const onSub = (sub as unknown as { current_period_end?: number }).current_period_end
  if (typeof onSub === 'number') return onSub
  const onItem = sub.items.data[0] as unknown as { current_period_end?: number } | undefined
  return typeof onItem?.current_period_end === 'number' ? onItem.current_period_end : null
}

export default async function StripeSubscriptionsPage() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Stripe subscriptions</h1>
        <p className="text-sm text-red-600">
          STRIPE_SECRET_KEY is not configured in this environment, so subscriptions can&apos;t be loaded.
        </p>
      </div>
    )
  }

  let subscriptions: Stripe.Subscription[]
  try {
    subscriptions = await getStripe().subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.customer'],
    }).autoPagingToArray({ limit: 500 })
  } catch (err) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-medium text-gray-900 mb-2">Stripe subscriptions</h1>
        <p className="text-sm text-red-600">
          Couldn&apos;t load subscriptions from Stripe: {err instanceof Error ? err.message : String(err)}
        </p>
      </div>
    )
  }

  // Cross-reference against our own data: does this Stripe customer correspond
  // to a student we know about, and is it already linked to a billing account?
  const admin = createAdminClient()
  const [{ data: profiles }, { data: accounts }] = await Promise.all([
    admin.from('profiles').select('id, full_name, email'),
    admin.from('billing_accounts').select('student_id, stripe_customer_id, stripe_subscription_id'),
  ])

  const profileByEmail = new Map(
    (profiles ?? [])
      .filter(p => p.email)
      .map(p => [p.email!.trim().toLowerCase(), p])
  )
  const linkedCustomerIds = new Set((accounts ?? []).map(a => a.stripe_customer_id).filter(Boolean))
  const linkedSubscriptionIds = new Set((accounts ?? []).map(a => a.stripe_subscription_id).filter(Boolean))

  const rows = subscriptions.map(sub => {
    const customer = sub.customer
    const isDeleted = typeof customer !== 'string' && customer.deleted
    const customerObj = typeof customer === 'string' || isDeleted ? null : (customer as Stripe.Customer)
    const customerId = typeof customer === 'string' ? customer : customer.id
    const email = customerObj?.email?.trim().toLowerCase() ?? ''

    const { amountCents, interval } = describeAmount(sub)
    const matched = email ? profileByEmail.get(email) : undefined

    return {
      id: sub.id,
      customerId,
      customerName: customerObj?.name ?? (isDeleted ? '(deleted customer)' : '—'),
      customerEmail: customerObj?.email ?? '',
      status: sub.status,
      amountCents,
      interval,
      created: sub.created,
      periodEnd: periodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      matchedStudentId: matched?.id ?? null,
      matchedStudentName: matched?.full_name ?? null,
      linked: linkedSubscriptionIds.has(sub.id) || linkedCustomerIds.has(customerId),
    }
  })

  const activeCount = rows.filter(r => r.status === 'active' || r.status === 'trialing').length
  const unlinkedCount = rows.filter(r => !r.linked).length
  const unmatchedCount = rows.filter(r => !r.matchedStudentId).length

  const csvRows: SubscriptionRow[] = rows.map(r => ({
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    stripeCustomerId: r.customerId,
    stripeSubscriptionId: r.id,
    status: r.status,
    amount: r.amountCents == null ? 'unknown' : (r.amountCents / 100).toFixed(2),
    interval: r.interval,
    created: formatDate(r.created),
    currentPeriodEnd: formatDate(r.periodEnd),
    cancelAtPeriodEnd: r.cancelAtPeriodEnd ? 'Yes' : 'No',
    matchedStudent: r.matchedStudentName ?? 'no match',
    linkedInApp: r.linked ? 'Yes' : 'No',
  }))

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Stripe subscriptions</h1>
          <p className="text-sm text-gray-400 mt-1">
            Read-only view of what actually exists in Stripe — {rows.length} subscription{rows.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/finances" className="text-xs text-gray-500 hover:text-gray-900">← Finances</Link>
          <ExportSubscriptionsButton rows={csvRows} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total in Stripe</p>
          <p className="text-2xl font-medium text-gray-900">{rows.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Active</p>
          <p className="text-2xl font-medium text-gray-900">{activeCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">incl. trialing</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Not linked in app</p>
          <p className={`text-2xl font-medium ${unlinkedCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{unlinkedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">no billing_accounts row</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">No matching student</p>
          <p className={`text-2xl font-medium ${unmatchedCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{unmatchedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">email not in profiles</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Customer</th>
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-gray-400 px-4 py-3">Amount</th>
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Cadence</th>
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Next period ends</th>
              <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Matched student</th>
              <th className="text-center text-xs font-medium text-gray-400 px-4 py-3">Linked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={i < rows.length - 1 ? 'border-b border-gray-50' : ''}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{r.customerName}</p>
                  <p className="text-xs text-gray-400">{r.customerEmail || 'no email on file'}</p>
                  <p className="text-xs text-gray-300 font-mono mt-0.5">{r.id}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {r.status}
                  </span>
                  {r.cancelAtPeriodEnd && <p className="text-xs text-amber-600 mt-1">cancels at period end</p>}
                </td>
                <td className="px-4 py-3 text-right text-gray-900">
                  {r.amountCents == null ? <span className="text-gray-400 text-xs">unknown</span> : formatCents(r.amountCents)}
                </td>
                <td className="px-4 py-3 text-gray-600">{r.interval}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(r.periodEnd)}</td>
                <td className="px-4 py-3">
                  {r.matchedStudentId
                    ? <Link href={`/admin/students/${r.matchedStudentId}`} className="text-gray-900 hover:underline">{r.matchedStudentName}</Link>
                    : <span className="text-amber-600 text-xs">no match</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  {r.linked ? '✓' : <span className="text-amber-600 text-xs">no</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No subscriptions found in Stripe.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        &ldquo;Matched student&rdquo; compares the Stripe customer email against <code>profiles.email</code>.
        &ldquo;Linked&rdquo; means a <code>billing_accounts</code> row already references this customer or subscription.
        This page only reads from Stripe — nothing here changes billing.
      </p>
    </div>
  )
}
