'use client'

export type SubscriptionRow = {
  customerName: string
  customerEmail: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  status: string
  amount: string
  interval: string
  created: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: string
  matchedStudent: string
  linkedInApp: string
}

const HEADER = [
  'Customer', 'Email', 'Stripe customer ID', 'Stripe subscription ID', 'Status',
  'Amount', 'Interval', 'Created', 'Current period ends', 'Cancels at period end',
  'Matched student', 'Linked in app',
]

export default function ExportSubscriptionsButton({ rows }: { rows: SubscriptionRow[] }) {
  function download() {
    const lines = [
      HEADER.join(','),
      ...rows.map(r =>
        [
          r.customerName, r.customerEmail, r.stripeCustomerId, r.stripeSubscriptionId, r.status,
          r.amount, r.interval, r.created, r.currentPeriodEnd, r.cancelAtPeriodEnd,
          r.matchedStudent, r.linkedInApp,
        ]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'stripe-subscriptions.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <button
      onClick={download}
      className="text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 transition-colors"
    >
      Export CSV
    </button>
  )
}
