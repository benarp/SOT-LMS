'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getStripe, DEPOSIT_CENTS, MONTHLY_CENTS, TOTAL_CYCLES } from '@/lib/billing'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'

// ── Shared ──────────────────────────────────────────────────

async function getOrCreateAccount(studentId: string, schoolYearId: string) {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('billing_accounts')
    .select('*')
    .eq('student_id', studentId)
    .eq('school_year_id', schoolYearId)
    .maybeSingle()
  if (existing) return existing

  const { data: profile } = await admin
    .from('profiles').select('full_name, email').eq('id', studentId).single()
  if (!profile?.email) throw new Error('Student has no email')

  const customer = await getStripe().customers.create({
    email: profile.email,
    name: profile.full_name || undefined,
    metadata: { student_id: studentId, school_year_id: schoolYearId },
  })

  const { data: account, error } = await admin
    .from('billing_accounts')
    .insert({
      student_id: studentId,
      school_year_id: schoolYearId,
      stripe_customer_id: customer.id,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return account
}

// ── Student: start checkout ─────────────────────────────────
// Deposit ($400) charged at checkout; $200/month subscription starts after a
// 30-day trial. The 10-cycle cap is enforced by the webhook.

export async function startCheckout(): Promise<{ error?: string } | never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: year } = await supabase
    .from('school_years').select('id, name').eq('is_active', true).single()
  if (!year) return { error: 'No active school year' }

  let account
  try {
    account = await getOrCreateAccount(user.id, year.id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not set up billing' }
  }
  if (account.status !== 'pending') return { error: 'Payment is already set up.' }

  // Checkout collects only the deposit and saves the card. The $200 x 10
  // subscription is created by the webhook afterwards — keeping Stripe's
  // trial/"per month until you cancel" language off the checkout page.
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    customer: account.stripe_customer_id,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `SOT Tuition ${year.name} — deposit` },
          unit_amount: DEPOSIT_CENTS,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      setup_future_usage: 'off_session',
    },
    metadata: { sot_purpose: 'tuition_deposit', student_id: user.id, school_year_id: year.id, year_name: year.name },
    custom_text: {
      submit: {
        message:
          `Today you pay the $${DEPOSIT_CENTS / 100} deposit. Your card will then be charged ` +
          `${TOTAL_CYCLES} monthly payments of $${MONTHLY_CENTS / 100}, starting in about a month — ` +
          `$${(DEPOSIT_CENTS + MONTHLY_CENTS * TOTAL_CYCLES) / 100} total for the year. ` +
          `Payments stop automatically after the ${TOTAL_CYCLES}th monthly payment.`,
      },
    },
    success_url: `${SITE_URL}/dashboard/billing?setup=success`,
    cancel_url: `${SITE_URL}/dashboard/billing?setup=cancelled`,
  })

  redirect(session.url!)
}

// ── Student: update card on file ────────────────────────────
// Students get a Stripe billing portal restricted to payment-method updates
// only — no self-service cancel or pause. Everything else is admin-only.

let portalConfigId: string | null = null

async function getPortalConfigId(): Promise<string> {
  if (portalConfigId) return portalConfigId
  const stripe = getStripe()
  const existing = await stripe.billingPortal.configurations.list({ limit: 100 })
  const match = existing.data.find(c => c.metadata?.sot_purpose === 'card_update_only')
  if (match) { portalConfigId = match.id; return match.id }
  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'School of Transformation — update your payment method' },
    features: {
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: false },
      invoice_history: { enabled: true },
    },
    metadata: { sot_purpose: 'card_update_only' },
  })
  portalConfigId = created.id
  return created.id
}

export async function openCardUpdatePortal(): Promise<{ error?: string } | never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: account } = await supabase
    .from('billing_accounts')
    .select('stripe_customer_id')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!account) return { error: 'No billing account yet.' }

  const session = await getStripe().billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    configuration: await getPortalConfigId(),
    return_url: `${SITE_URL}/dashboard/billing`,
  })
  redirect(session.url)
}

// ── Admin operations ────────────────────────────────────────

async function adminAccount(accountId: string) {
  const admin = createAdminClient()
  const { data: account } = await admin
    .from('billing_accounts').select('*').eq('id', accountId).single()
  if (!account) throw new Error('Billing account not found')
  return { admin, account }
}

async function logBillingEvent(
  accountId: string, type: string, amountCents: number | null,
  stripeObjectId: string | null, notes: string | null, actorId: string
) {
  await createAdminClient().from('billing_events').insert({
    billing_account_id: accountId,
    type,
    amount_cents: amountCents,
    stripe_object_id: stripeObjectId,
    notes,
    created_by: actorId,
  })
}

export async function pausePayments(accountId: string): Promise<{ error?: string }> {
  try {
    const ctx = await requireAdmin()
    const { admin, account } = await adminAccount(accountId)
    if (!account.stripe_subscription_id) return { error: 'No active subscription to pause.' }

    // 'void' skips invoices while paused; what's owed is derived from
    // expected vs paid cycles, so nothing is lost by not drafting invoices
    await getStripe().subscriptions.update(account.stripe_subscription_id, {
      pause_collection: { behavior: 'void' },
    })
    await admin.from('billing_accounts').update({
      status: 'paused', paused_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', accountId)

    await logBillingEvent(accountId, 'paused', null, account.stripe_subscription_id, null, ctx.user.id)
    await logAudit({ actor_id: ctx.user.id, actor_email: ctx.profile.email, action: 'billing_paused', target_type: 'billing_account', target_id: accountId })
    revalidatePath(`/admin/students/${account.student_id}`)
    revalidatePath('/admin/finances')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Pause failed' }
  }
}

export async function resumePayments(accountId: string): Promise<{ error?: string }> {
  try {
    const ctx = await requireAdmin()
    const { admin, account } = await adminAccount(accountId)
    if (!account.stripe_subscription_id) return { error: 'No subscription to resume.' }

    await getStripe().subscriptions.update(account.stripe_subscription_id, {
      pause_collection: null,
    })
    await admin.from('billing_accounts').update({
      status: 'active', paused_at: null, updated_at: new Date().toISOString(),
    }).eq('id', accountId)

    await logBillingEvent(accountId, 'resumed', null, account.stripe_subscription_id, null, ctx.user.id)
    await logAudit({ actor_id: ctx.user.id, actor_email: ctx.profile.email, action: 'billing_resumed', target_type: 'billing_account', target_id: accountId })
    revalidatePath(`/admin/students/${account.student_id}`)
    revalidatePath('/admin/finances')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Resume failed' }
  }
}

export async function applyCredit(accountId: string, amountDollars: number, notes: string): Promise<{ error?: string }> {
  try {
    const ctx = await requireAdmin()
    const { admin, account } = await adminAccount(accountId)
    const cents = Math.round(amountDollars * 100)
    if (!Number.isFinite(cents) || cents <= 0) return { error: 'Enter a positive dollar amount.' }
    if (!notes.trim()) return { error: 'A note is required (e.g. "Merit scholarship — approved by Ben").' }

    // Negative customer balance = credit applied against future invoices
    await getStripe().customers.createBalanceTransaction(account.stripe_customer_id, {
      amount: -cents,
      currency: 'usd',
      description: notes.trim(),
    })
    await admin.from('billing_accounts').update({
      credits_applied_cents: account.credits_applied_cents + cents,
      updated_at: new Date().toISOString(),
    }).eq('id', accountId)

    await logBillingEvent(accountId, 'credit_applied', cents, account.stripe_customer_id, notes.trim(), ctx.user.id)
    await logAudit({ actor_id: ctx.user.id, actor_email: ctx.profile.email, action: 'billing_credit_applied', target_type: 'billing_account', target_id: accountId, detail: { cents, notes } })
    revalidatePath(`/admin/students/${account.student_id}`)
    revalidatePath('/admin/finances')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Credit failed' }
  }
}

export async function cancelBilling(accountId: string): Promise<{ error?: string }> {
  try {
    const ctx = await requireAdmin()
    const { admin, account } = await adminAccount(accountId)

    if (account.stripe_subscription_id) {
      await getStripe().subscriptions.cancel(account.stripe_subscription_id).catch(() => null)
    }
    await admin.from('billing_accounts').update({
      status: 'cancelled', updated_at: new Date().toISOString(),
    }).eq('id', accountId)

    await logBillingEvent(accountId, 'cancelled', null, account.stripe_subscription_id, 'Cancelled by admin', ctx.user.id)
    await logAudit({ actor_id: ctx.user.id, actor_email: ctx.profile.email, action: 'billing_cancelled', target_type: 'billing_account', target_id: accountId })
    revalidatePath(`/admin/students/${account.student_id}`)
    revalidatePath('/admin/finances')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Cancel failed' }
  }
}

export async function issueRefund(accountId: string, paymentIntentId: string, amountDollars: number): Promise<{ error?: string }> {
  try {
    const ctx = await requireAdmin()
    const { admin, account } = await adminAccount(accountId)
    const cents = Math.round(amountDollars * 100)
    if (!Number.isFinite(cents) || cents <= 0) return { error: 'Enter a positive dollar amount.' }
    if (!paymentIntentId.trim()) return { error: 'Select a charge to refund.' }

    const refund = await getStripe().refunds.create({
      payment_intent: paymentIntentId.trim(),
      amount: cents,
    })
    await admin.from('billing_accounts').update({
      total_collected_cents: Math.max(0, account.total_collected_cents - cents),
      updated_at: new Date().toISOString(),
    }).eq('id', accountId)

    await logBillingEvent(accountId, 'refund_issued', cents, refund.id, `Refund of payment ${paymentIntentId}`, ctx.user.id)
    await logAudit({ actor_id: ctx.user.id, actor_email: ctx.profile.email, action: 'billing_refund_issued', target_type: 'billing_account', target_id: accountId, detail: { cents, paymentIntentId } })
    revalidatePath(`/admin/students/${account.student_id}`)
    revalidatePath('/admin/finances')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Refund failed' }
  }
}
