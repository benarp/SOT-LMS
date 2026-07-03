import Stripe from 'stripe'

// Pricing model (docs/billing-spec.md): $400 deposit collected at checkout,
// then $200/month × 10 months starting ~1 month later. $2,400 total.
export const DEPOSIT_CENTS = 40000
export const MONTHLY_CENTS = 20000
export const TOTAL_CYCLES = 10
export const TOTAL_TUITION_CENTS = DEPOSIT_CENTS + MONTHLY_CENTS * TOTAL_CYCLES
// Gap between the deposit and the first monthly charge. Implemented as a
// billing_cycle_anchor (not a Stripe trial) so Checkout doesn't render
// "free trial" language.
export const FIRST_MONTHLY_DELAY_DAYS = 30

export const BILLING_STATUS_LABELS: Record<string, string> = {
  pending: 'Not started',
  active: 'Active',
  paused: 'Paused',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  completed: 'Paid in full',
}

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return stripeClient
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/**
 * Months elapsed since the monthly cycle began, capped at TOTAL_CYCLES.
 * Outstanding balance = (expected − paid) × MONTHLY_CENTS, floored at 0.
 * Derived rather than stored, so paused/failed months are always accurate.
 */
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

/**
 * Date of the student's next scheduled $200 charge, or null if there isn't
 * one (all cycles paid, or the account isn't in a billing state). Derived
 * from the anchor date + how many cycles have been paid.
 */
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

/** Date of the final ($200 × 10th) payment for this account. */
export function finalPaymentDate(monthlyStartsAt: string | null): Date | null {
  if (!monthlyStartsAt) return null
  return addMonths(monthlyStartsAt, TOTAL_CYCLES - 1)
}

/** How much of the $2,400 year is still to be collected, after credits. */
export function remainingCents(account: {
  total_collected_cents: number
  credits_applied_cents: number
}): number {
  return Math.max(0, TOTAL_TUITION_CENTS - account.total_collected_cents - account.credits_applied_cents)
}
