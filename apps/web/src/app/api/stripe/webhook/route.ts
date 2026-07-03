import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, MONTHLY_CENTS, TOTAL_CYCLES, FIRST_MONTHLY_DELAY_DAYS } from '@/lib/billing'
import { Resend } from 'resend'

// Stripe → DB sync. Stripe signs each event; constructEvent rejects anything
// that wasn't signed with our webhook secret, so this route can be public.
export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Webhook not configured', { status: 500 })
  }

  const stripe = getStripe()
  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const admin = createAdminClient()

  async function accountByCustomer(customerId: string) {
    const { data } = await admin
      .from('billing_accounts')
      .select('id, student_id, status, cycles_paid, total_collected_cents, deposit_paid, stripe_subscription_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    return data
  }

  async function logEvent(accountId: string, type: string, amountCents: number | null, stripeObjectId: string | null, notes?: string) {
    await admin.from('billing_events').insert({
      billing_account_id: accountId,
      type,
      amount_cents: amountCents,
      stripe_object_id: stripeObjectId,
      notes: notes ?? null,
    })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.metadata?.sot_purpose !== 'tuition_deposit') break
      const account = await accountByCustomer(session.customer as string)
      if (!account) break
      // Deposit already processed (webhook retry) — don't double-create
      if (account.deposit_paid) break

      // Checkout only charged the deposit and saved the card; create the
      // monthly subscription here. trial_end delays the first $200 charge —
      // the student never sees Stripe's trial UI since this isn't a Checkout
      // subscription. The cycle cap is enforced in invoice.payment_succeeded.
      const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string)
      const paymentMethodId = paymentIntent.payment_method as string
      const firstMonthlyAt = Math.floor(Date.now() / 1000) + FIRST_MONTHLY_DELAY_DAYS * 24 * 60 * 60

      const sub = await stripe.subscriptions.create({
        customer: session.customer as string,
        items: [{
          price_data: {
            currency: 'usd',
            product: await getTuitionProductId(stripe),
            unit_amount: MONTHLY_CENTS,
            recurring: { interval: 'month' },
          },
        }],
        trial_end: firstMonthlyAt,
        default_payment_method: paymentMethodId,
        metadata: {
          student_id: session.metadata?.student_id ?? '',
          school_year_id: session.metadata?.school_year_id ?? '',
        },
      })

      await admin.from('billing_accounts').update({
        stripe_subscription_id: sub.id,
        status: 'active',
        deposit_paid: true,
        total_collected_cents: account.total_collected_cents + (session.amount_total ?? 0),
        monthly_starts_at: new Date(firstMonthlyAt * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', account.id)

      await logEvent(account.id, 'deposit_paid', session.amount_total ?? 0, session.payment_intent as string | null)
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object
      // The deposit arrives via checkout.session.completed; only count
      // recurring monthly cycles here.
      if (invoice.billing_reason !== 'subscription_cycle') break
      const account = await accountByCustomer(invoice.customer as string)
      if (!account) break

      const cyclesPaid = account.cycles_paid + 1
      const done = cyclesPaid >= TOTAL_CYCLES

      await admin.from('billing_accounts').update({
        cycles_paid: cyclesPaid,
        total_collected_cents: account.total_collected_cents + (invoice.amount_paid ?? 0),
        status: done ? 'completed' : 'active',
        updated_at: new Date().toISOString(),
      }).eq('id', account.id)

      await logEvent(account.id, 'payment_succeeded', invoice.amount_paid ?? 0, invoice.id ?? null,
        `Month ${cyclesPaid} of ${TOTAL_CYCLES}`)

      // All 10 cycles collected — end the subscription so nothing further bills
      if (done && account.stripe_subscription_id) {
        await stripe.subscriptions.cancel(account.stripe_subscription_id).catch(() => null)
        await logEvent(account.id, 'completed', null, account.stripe_subscription_id,
          'All cycles paid — subscription ended automatically')
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const account = await accountByCustomer(invoice.customer as string)
      if (!account) break
      // Admin-paused accounts aren't overdue — Stripe may still emit failures
      // for draft invoices depending on pause behavior
      if (account.status !== 'paused') {
        await admin.from('billing_accounts').update({
          status: 'overdue',
          updated_at: new Date().toISOString(),
        }).eq('id', account.id)
      }
      await logEvent(account.id, 'payment_failed', invoice.amount_due ?? 0, invoice.id ?? null)
      await notifyPaymentFailure(admin, account.student_id, invoice.amount_due ?? 0)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const account = await accountByCustomer(sub.customer as string)
      if (!account) break
      // completed = we cancelled it ourselves after cycle 10; leave that be
      if (account.status !== 'completed' && account.status !== 'cancelled') {
        await admin.from('billing_accounts').update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        }).eq('id', account.id)
        await logEvent(account.id, 'cancelled', null, sub.id, 'Subscription ended in Stripe')
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object
      const account = await accountByCustomer(sub.customer as string)
      if (!account) break
      // Sync pause state if it was changed directly in the Stripe dashboard
      const paused = !!sub.pause_collection
      if (paused && account.status === 'active') {
        await admin.from('billing_accounts').update({
          status: 'paused', paused_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', account.id)
      } else if (!paused && account.status === 'paused') {
        await admin.from('billing_accounts').update({
          status: 'active', paused_at: null, updated_at: new Date().toISOString(),
        }).eq('id', account.id)
      }
      break
    }
  }

  return new Response('ok')
}

// Reusable product for the monthly tuition price, found/created by metadata
let tuitionProductId: string | null = null

async function getTuitionProductId(stripe: Stripe): Promise<string> {
  if (tuitionProductId) return tuitionProductId
  const existing = await stripe.products.list({ limit: 100, active: true })
  const match = existing.data.find(p => p.metadata?.sot_purpose === 'monthly_tuition')
  if (match) { tuitionProductId = match.id; return match.id }
  const created = await stripe.products.create({
    name: `SOT Tuition — $${MONTHLY_CENTS / 100}/month x ${TOTAL_CYCLES} months`,
    metadata: { sot_purpose: 'monthly_tuition' },
  })
  tuitionProductId = created.id
  return created.id
}

async function notifyPaymentFailure(
  admin: ReturnType<typeof createAdminClient>,
  studentId: string,
  amountCents: number
) {
  if (!process.env.RESEND_API_KEY) return
  const recipients = (process.env.BILLING_ALERT_EMAILS || 'barp@allpeopleschurch.org')
    .split(',').map(e => e.trim()).filter(Boolean)
  if (recipients.length === 0) return

  const { data: student } = await admin
    .from('profiles').select('full_name, email').eq('id', studentId).single()

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'onboarding@resend.dev', // TODO: swap after domain verification
    to: recipients,
    subject: `Payment failed — ${student?.full_name || 'a student'} | SOT billing`,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:40px auto;color:#111827;">
      <h2 style="font-size:17px;">Tuition payment failed</h2>
      <p><strong>${student?.full_name || 'Unknown student'}</strong> (${student?.email || '—'}) had a charge of
      $${(amountCents / 100).toFixed(2)} fail. Their account is now marked overdue.</p>
      <p>Stripe will retry automatically per your dunning settings. You can review the account in the
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'}/admin/finances">Finances section</a>.</p>
    </body></html>`,
  }).catch(err => console.error('payment failure email failed:', err))
}
