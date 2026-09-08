# Launch readiness — written 2026-09-07, for class on Tues 2026-09-08

Status recap of the Align → SOT-LMS migration, and what still has to happen before
the 28 students can be pointed at this app.

> **Timing note:** the 2026–2027 calendar has **Week 1 on Tues 9/1/2026**, which has
> already passed. **Tomorrow (Tues 9/8) is Week 2.** Anything shown to students needs
> to make sense given Week 1 is already behind them.

---

## ✅ Done today

**School year + curriculum structure**
- `school_years` row `2026-2027` created (9/1/2026 – 5/11/2027), **currently inactive**
- All **32 Tuesday weeks** generated, correctly skipping Thanksgiving (11/24), Winter
  Break (12/16–1/8), and Easter/Spring Break (3/23). Week 31 = Final, Week 32 = Graduation
- Due times set to 6:00 PM America/Chicago
- Script: `apps/web/supabase/setup-2026-2027-year.sql` (already run)

**Student accounts**
- **28 accounts created** from the Align roster export, all `role: student`
- Name, email, birthday, phone, gender imported
- `profiles.phone` and `profiles.gender` added as **admin-only** columns (column-level
  `REVOKE SELECT` from `authenticated` — students and group leaders cannot read them)
- Scripts: `apps/web/supabase/migration-profile-contact-fields.sql`,
  `apps/web/scripts/import-align-roster.js` (both already run)

**Pre-launch gate**
- `COMING_SOON` flag in `apps/web/src/proxy.ts` — students/group leaders see only
  `/coming-soon`; `/reset-password` stays reachable so they can still set passwords.
  Admins unaffected. Deployed and live.

**Email infrastructure**
- Supabase Custom SMTP enabled against Resend, sender `admin@schooloftransformation.app`,
  auth email rate limit raised, forgot-password retested with inbox delivery confirmed.
  (This had been broken since at least 2026-07-15 — see `plan.md` item 3.)

**Stripe review page**
- New read-only admin page at `/admin/finances/stripe` listing every Stripe subscription,
  cross-referenced against `profiles.email` and `billing_accounts`, flagging anything
  unmatched or unlinked. CSV export included. Built specifically to avoid needing API
  secrets in a local shell.

---

## ❌ Dead ends / what didn't work

**Stripe is completely blocked.** Production's `STRIPE_SECRET_KEY` is set to an API key's
**ID** (`mk_1IoEc…`), not the secret value. Every Stripe API call in production fails.
Fixing it requires dashboard access that currently sits with a colleague.

This is worse than just the review page being broken — it means checkout, the billing
portal, admin pause/credit/refund, and parts of the webhook handler (`paymentIntents.retrieve`,
`subscriptions.create`, `products.list`) are all non-functional in production. No live
tuition has run through the app yet, so nothing has actually broken for a real family — but
this must be fixed before it does.

**Local Stripe key is test-mode** (`livemode: false`, 5 test customers, 1 test subscription),
so the real plans can't be inspected from local dev either.

**Still unknown:** whether the Align-era per-student payment plans even live in this Stripe
account, or in a separate one. Until someone with access looks, the billing migration can't
be designed.

---

## ⚠️ Mistake made today, for the record

The roster import script created the 28 accounts **and immediately sent password-setup
emails to all 28 real students** in one run. That send was described in advance but not
called out as its own decision, and it went out before Custom SMTP was fixed — so all 25
that "succeeded" went through Supabase's old shared mailer, which has known poor Gmail
deliverability and was the exact cause of a previous incident (Luke McGrath, 2026-07-15).

**3 students never received anything at all** (rate-limited mid-run):
- Yolanda Prado — prado_yolanda@yahoo.com
- Teresa Dutra — tere-adutra@att.net
- Rae Mayforth — raeanna.mayforth@gmail.com

The other 25 may or may not have arrived; delivery was never confirmed. A re-send to all
28 is almost certainly needed, but was deliberately **not** done — no further emails have
been sent.

---

## 🚧 What's left before showing students

### Blockers — the app is not usable by students until these are done

1. **Activate the 2026–2027 school year.**
   It's currently `is_active = false`, so students would see an empty dashboard.
   Do it at `/admin/settings`.
   - ⚠️ Activating deactivates whatever year is currently active — confirm that's intended
   - ⚠️ Activation also auto-promotes paid/approved applicants to `student`; the imported
     28 are already students so they're unaffected, but check nobody unexpected gets pulled in

2. **Replace the placeholder homework.**
   Weeks 1–6 currently contain literal `TBD` items labeled
   `[Placeholder — fill in via admin curriculum panel]`. Students must not see these.
   At minimum, real content for **Week 2 (tomorrow, 9/8)** — and a decision on what to do
   about **Week 1 (9/1), which has already passed** and is now overdue.
   Edit at `/admin/curriculum`.

3. **Get students able to log in.**
   Password-setup emails are unreliable (see above). Now that SMTP is fixed, re-send to
   all 28 — but **test with 2–3 addresses first and confirm inbox delivery** before the
   full batch. Nothing has been re-sent yet.

4. **Turn off the Coming Soon gate.**
   Flip `COMING_SOON` to `false` in `apps/web/src/proxy.ts`, commit, push (auto-deploys).
   Do this **last**, after 1–3 are verified — it's the switch that exposes everything.

### Should do, but not strictly blocking

5. **Assign groups and group leaders.** No groups exist for this year yet. Students will
   have `group_id = null`, which is tolerated but means group leaders see nobody.
   Create at `/admin/settings`, assign at `/admin/students`.

6. **Verify the gate actually works for a real student account.** It's verified locally and
   by code inspection, but never confirmed in production with a real student session —
   log in as one (or impersonate) and confirm.

### Not blocking tomorrow

7. **Stripe** — blocked on the key. Students can attend and do homework without billing
   being wired up. Needs to be resolved before tuition collection, not before class.

8. **Mobile app** — has its own login and is **not** behind the Coming Soon gate. Low risk
   (unlikely anyone has it installed), but it's a hole if students are told about the app.

---

## Suggested order for tomorrow

```
1. Fill in Week 2 homework (and decide about Week 1)   ← do first, it's the real work
2. Activate the 2026–2027 school year
3. Log in as a test student, confirm the dashboard looks right
4. Send password emails to 2–3 students, confirm delivery
5. Send to the remaining students
6. Flip COMING_SOON to false, deploy
7. Tell the class
```

Steps 2–7 are quick. Step 1 is the one that needs actual time.
