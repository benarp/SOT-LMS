// Portable pure helpers mirroring apps/web/src/lib/billing.ts. No Stripe SDK
// here — mobile only reads billing_accounts/billing_events via Supabase RLS.
export const DEPOSIT_CENTS = 40000
export const MONTHLY_CENTS = 20000
export const TOTAL_CYCLES = 10
export const TOTAL_TUITION_CENTS = DEPOSIT_CENTS + MONTHLY_CENTS * TOTAL_CYCLES

export const BILLING_STATUS_LABELS: Record<string, string> = {
  pending: 'Not started',
  active: 'Active',
  paused: 'Paused',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  completed: 'Paid in full',
}

export const BILLING_EVENT_LABELS: Record<string, string> = {
  deposit_paid: 'Deposit paid',
  payment_succeeded: 'Payment received',
  payment_failed: 'Payment failed',
  paused: 'Payments paused',
  resumed: 'Payments resumed',
  credit_applied: 'Credit applied',
  cancelled: 'Billing cancelled',
  completed: 'Paid in full',
  refund_issued: 'Refund issued',
  offline_payment: 'Cash/check payment',
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function expectedCycles(monthlyStartsAt: string | null, now = new Date()): number {
  if (!monthlyStartsAt) return 0
  const start = new Date(monthlyStartsAt)
  if (now < start) return 0
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) +
    (now.getDate() >= start.getDate() ? 1 : 0)
  return Math.max(0, Math.min(TOTAL_CYCLES, months))
}

export function outstandingCents(account: {
  status: string
  monthly_starts_at: string | null
  cycles_paid: number
}): number {
  if (account.status === 'pending' || account.status === 'cancelled') return 0
  const expected = expectedCycles(account.monthly_starts_at)
  return Math.max(0, (expected - account.cycles_paid) * MONTHLY_CENTS)
}

function addMonths(iso: string, months: number): Date {
  const d = new Date(iso)
  d.setMonth(d.getMonth() + months)
  return d
}

export function nextPaymentDate(account: {
  status: string
  monthly_starts_at: string | null
  cycles_paid: number
}): Date | null {
  if (!account.monthly_starts_at) return null
  if (account.status !== 'active' && account.status !== 'overdue') return null
  if (account.cycles_paid >= TOTAL_CYCLES) return null
  return addMonths(account.monthly_starts_at, account.cycles_paid)
}

export function finalPaymentDate(monthlyStartsAt: string | null): Date | null {
  if (!monthlyStartsAt) return null
  return addMonths(monthlyStartsAt, TOTAL_CYCLES - 1)
}

export function remainingCents(account: {
  total_collected_cents: number
  credits_applied_cents: number
}): number {
  return Math.max(0, TOTAL_TUITION_CENTS - account.total_collected_cents - account.credits_applied_cents)
}
