# Billing — Feature Spec
# Stripe Integration for School of Transformation

**Status:** Backlog  
**Priority:** Pre-launch (required before first paid cohort)

---

## Overview

Every accepted student pays a deposit and then a monthly tuition for the duration of the school year. Billing is managed entirely through Stripe. The admin has full control over each student's billing status from within the platform.

---

## Pricing Model

| Charge | Amount | Timing |
|---|---|---|
| Deposit | $400 | On acceptance (one-time, collected immediately) |
| Monthly tuition | $200 × 10 months | Starting ~1 month after deposit |
| **Total** | **$2,400** | Per school year |

The deposit is not a separate pre-payment — it is the first installment collected up front. The remaining $2,000 is billed in 10 monthly increments of $200.

---

## Student Experience

1. Student is accepted → receives acceptance email
2. Email includes a link to a **payment setup page** (Stripe-hosted or embedded)
3. Student enters card details — deposit ($400) is charged immediately
4. Stripe subscription begins for the monthly $200 charges
5. Student sees payment status on their dashboard (current, paused, etc.)

---

## Admin Operations

All billing actions are available from the student's profile page in the admin panel.

### Payment status
- View current status: active, paused, overdue, cancelled
- View next charge date and amount
- View full payment history (date, amount, status per charge)
- View outstanding balance (relevant when payments were paused mid-year)

### Actions

| Action | Description |
|---|---|
| **Pause payments** | Suspends the Stripe subscription. Tracks the outstanding balance (months × $200 still owed). Student retains access to the platform. |
| **Resume payments** | Reactivates the subscription. Admin chooses whether to resume at the original schedule or adjust for missed payments. |
| **Apply credit / scholarship** | Applies a dollar amount as a Stripe customer balance credit, reducing future charges. Should include a notes field (e.g., "Merit scholarship — approved by Ben"). |
| **Cancel subscription** | Ends all future billing. Used when a student drops out. Does not automatically issue a refund. |
| **Issue refund** | Refunds a specific charge (partial or full). Used for billing errors. Requires selecting the charge and an amount. |

---

## Financial Reporting

A dedicated **Finances** section in the admin panel (separate from the student completion reports).

### Summary cards
- Total collected (current school year, year-to-date)
- Active subscriptions
- Paused subscriptions
- Cancelled subscriptions
- Overdue accounts (payment failed, not paused by admin)
- Total outstanding balance across paused accounts
- Scholarships/credits applied (total dollar amount)

### Student-level table
Filterable list of all billing accounts with columns:
- Student name
- Status (active / paused / overdue / cancelled)
- Deposit paid (yes/no)
- Total collected to date
- Outstanding balance
- Next charge date
- Last charge date + outcome

### Export
- CSV export of the billing table for a school year

---

## Stripe Implementation Notes

### Stripe objects used
- **Customer** — one per student (created at acceptance)
- **Payment Method** — card on file, attached to customer
- **Payment Intent** — for the initial $400 deposit
- **Subscription** — recurring $200/month, 10 billing cycles
- **Invoice** — auto-generated per subscription cycle
- **Customer Balance** — used for scholarship/credit application
- **Refund** — issued against a specific charge

### Key Stripe features
- **Subscription pausing** — Stripe supports `pause_collection` on subscriptions (marks invoices as void or keeps them as draft; admin should choose "keep balance" to track what's owed)
- **Subscription schedules** — optional; could be used to enforce exactly 10 billing cycles
- **Webhooks** — required to sync payment status back to the platform (payment succeeded, payment failed, subscription cancelled, etc.)

### Environment variables needed
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Database additions needed
- `billing_accounts` — one per student per school year; stores Stripe customer ID, subscription ID, status, outstanding balance
- `billing_events` — log of all charges, refunds, credits for audit trail

### Webhook events to handle
- `invoice.payment_succeeded` — mark charge as paid, update collected total
- `invoice.payment_failed` — flag account as overdue, trigger admin notification
- `customer.subscription.deleted` — sync cancellation status
- `customer.subscription.updated` — sync pause/resume status

---

## Out of Scope (for now)

- Student self-service payment management (they cannot update their own card — admin handles it)
- Automatic dunning / retry emails (handled by Stripe's built-in dunning settings)
- Multi-currency support
- ACH / bank transfer support
- Installment plans other than the standard 10×$200

---

## Open Questions

- Should the deposit page be Stripe-hosted (Stripe Payment Links) or embedded in the platform?
  - Stripe-hosted = faster to build, less control over design
  - Embedded = better UX, more work
- What happens to billing if a student defers to the next school year? (Pause indefinitely or cancel + re-enroll?)
- Is the $400 deposit refundable if a student is accepted but declines? Under what conditions?
- Who else (besides Ben) should receive payment failure notifications?
