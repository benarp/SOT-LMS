import Stripe from 'stripe'

// Pricing model (docs/billing-spec.md): $400 deposit collected at checkout,
// then $200/month × 10 months starting ~1 month later. $2,400 total.
export const DEPOSIT_CENTS = 40000
export const MONTHLY_CENTS = 20000
export const TOTAL_CYCLES = 10
export const TRIAL_DAYS = 30 // gap between deposit and first monthly charge

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
