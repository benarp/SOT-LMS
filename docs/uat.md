# SOT-LMS — User Acceptance Testing

Run top to bottom before the first real cohort. Check items off as they pass.
Where a test needs a specific account, it's noted. Recommended test accounts:

- **Admin** — your account (barp@allpeopleschurch.org)
- **Student** — a test student in the active year (e.g. Amy)
- **Applicant** — a fresh email you control (create during §5)
- **Group leader** — a test account with role `group_leader` assigned to a group
- A spare inbox you can receive email at (invites, references, resets)

> Email tests: sender is `onboarding@resend.dev` until the domain is verified.
> Billing tests: Stripe test mode — card `4242 4242 4242 4242`, any expiry/CVC/ZIP.
> Decline card: `4000 0000 0000 9995`.

---

## 1. Authentication

- [ ] Log in with a valid student account → lands on the student dashboard
- [ ] Log in with a wrong password → clear error, no crash
- [ ] Visit any protected URL (e.g. `/dashboard`, `/admin`) signed out → redirected to `/login`
- [ ] Log in as student, visit `/admin` → redirected to `/dashboard` (no admin access)
- [ ] "Forgot password?" with a real account email → reset email arrives → link opens reset page → new password works
- [ ] Admin → student detail → Deactivate → that student can no longer sign in; Reactivate → sign-in works again

## 2. Student dashboard & homework

*As a student in the active year, with a current week that has all four item types.*

- [ ] This Week shows the current week's items with progress bar
- [ ] Mark a Scripture Reading complete → progress updates instantly; refresh → still complete
- [ ] Un-check it → reverts, refresh → still incomplete
- [ ] Video item: YouTube embeds and plays; a non-embeddable URL shows "Watch video →" link instead
- [ ] Reflection item: type a response → Save response → "✓ Response saved"; edit → Update response works
- [ ] Complete an item after the due date → shows "Submitted late" with timestamp
- [ ] **Previous weeks**: open a past week → can still complete items and submit/edit reflections there (marked late)
- [ ] Saved reflection text is fully readable (not washed out) in both light and dark mode

## 3. Tuition (student)

*As a student in the active year with no billing set up. Stripe listener running locally
(`stripe listen --latest --api-key sk_test_… --forward-to localhost:3000/api/stripe/webhook`).*

- [ ] Tuition tab shows "$2,400 … $400 deposit today, then $200/month for 10 months" and status **Not started**
- [ ] Set up payment → Stripe checkout shows **only the $400 deposit** (no "trial"/"per month until you cancel" language) with the 10-payment explanation under the button
- [ ] Cancel out of checkout → back on Tuition page with a "cancelled" notice, still Not started
- [ ] Complete checkout with 4242 card → success banner; status flips to **Active**, deposit Paid, 0 of 10 ($200.00 each), next payment date ~1 month out, remaining $2,000, final payment date ~11 months out
- [ ] "Update card on file" → Stripe portal opens; **no cancel-subscription option**; card can be updated; returns to Tuition page
- [ ] In Stripe (test mode) the customer has an active $200/month subscription created automatically

## 4. Announcements & weekly email

*As admin.*

- [ ] Create an announcement → appears at top of the student dashboard immediately
- [ ] Delete it → gone from the dashboard
- [ ] "Send test to me" → formatted email arrives at your address with `[TEST]` subject, next week's items, announcements
- [ ] "Send weekly email" → arrives for enrolled students; "last sent" date appears; trying again within 5 days warns first
- [ ] Click Unsubscribe in a student's email → confirmation page; that student is skipped on the next send

## 5. Application — applicant experience

*Signed out, applications window open. Use a fresh email.*

- [ ] `/apply` when the window is **closed** (temporarily clear the window in Settings) → "not open" message; restore window after
- [ ] Create an applicant account → lands in the questionnaire
- [ ] Step 1 is Contact (name/phone/city); Continue with a blank field → validation error
- [ ] Authored steps match the form builder sections; progress bar advances; Back works
- [ ] Type an answer, wait a beat ("Saved automatically"), close the tab, log back in → answer is still there
- [ ] A required question left blank blocks Continue with a clear message
- [ ] Branching: answer the controlling question so the conditional question appears; flip the answer → it disappears; its hidden answer is not required to proceed
- [ ] Final step Submit → moves to the pastoral reference step
- [ ] Enter pastor name/email/church → reference request email arrives at the pastor address; status page shows **Reference requested** and step tracker (Questionnaire ✓, Reference waiting, Interview, Decision)
- [ ] Open the pastor link (no login needed) → fill 4 questions → submit → confirmation email to pastor
- [ ] Applicant status page now shows **Interview** stage, reference "Received from …"
- [ ] Applicant cannot reach `/dashboard` (redirected to status page)

## 6. Admin — form builder

*As admin at `/admin/applications/settings`.*

- [ ] Questions are grouped visually under dark section-header bands
- [ ] Add one of each type: header, note, short answer, paragraph, yes/no, select, checkbox group → all render correctly in preview
- [ ] Edit a question's label/hint/options → changes save and appear in preview
- [ ] Options editor: one per line → each becomes a choice
- [ ] Branching: set "only show when [earlier yes/no] = Yes" → value dropdown offers Yes/No; for a select source it offers that question's options
- [ ] Drag a question within a section → order persists after refresh
- [ ] Drag a question into a different section → persists
- [ ] Drag a section header → its position persists
- [ ] **Preview form** → modal shows the exact applicant UI; branching works live; "Preview — nothing is saved"; Submit says preview is disabled; nothing appears in any application
- [ ] Delete an unanswered question → gone; delete one that has answers → blocked with explanation

## 7. Admin — application review & pipeline

*As admin at `/admin/applications`, using the §5 applicant.*

- [ ] List shows stage badges and counts (Awaiting reference / Interview / Accepted)
- [ ] Open the application → all dynamic answers render in order; checkbox answers as ✓ list; reference content shown
- [ ] **Waive path** (needs a second applicant still in Reference requested): "Move to interview without reference" requires a note; after confirming, status is Interview and the amber waiver note shows on the application; audit_log has `application_reference_waived`
- [ ] At Interview stage: Accept → acceptance email arrives with "Set up tuition payment" button; status Accepted
- [ ] Decline path (third test applicant or re-test later): decline email arrives; applicant status page shows "not able to offer you a spot"

## 8. Accepted applicant → tuition → enrollment

*As the accepted applicant from §7.*

- [ ] Status page shows only: Accepted congratulations + **Tuition card** + completed step tracker — no homework/portal access
- [ ] Set up tuition → Stripe checkout (same deposit-only page) → complete with 4242 → returns to status page → "✓ Deposit received"
- [ ] Still no `/dashboard` access (they're gated until their year activates)
- [ ] *(Big one — do in a quiet moment)* Activate their school year in Settings → this applicant becomes a student; an accepted applicant **without** a deposit stays an applicant
- [ ] After activation: the new student can log in and sees the (empty) new year dashboard

## 9. Admin — students & transfer accounts

- [ ] Users table: sort, filter, CSV export downloads with correct columns
- [ ] Payment column shows live billing status (Active/Not started/…)
- [ ] Student detail: edit name/email; change role; assign group; send password-setup email (arrives)
- [ ] Impersonation: View as student → banner shows; actions record as them; Exit returns to admin; audit_log has both entries
- [ ] **Add student → Send invite email**: invite arrives; link lets them set a password
- [ ] **Add student → Create account only (transfer)**: no email sent; account appears in Users as student; "Forgot password?" with that email delivers a reset link; after setting a password they land on the student dashboard
- [ ] Adding a duplicate email (either mode) → friendly error

## 10. Admin — billing controls & finances

*As admin, on a student with active billing (from §3).*

- [ ] Billing panel shows status, deposit, months paid, collected, history
- [ ] Pause → status Paused (student's Tuition page shows paused note, no next-payment date); Resume → Active again
- [ ] Apply credit without a note → blocked; with note → credit appears in history and in Stripe customer balance
- [ ] Refund: pick the deposit charge, refund a partial amount → shows in history; Stripe shows the refund
- [ ] Cancel billing → status Cancelled; Stripe subscription cancelled
- [ ] All of the above appear in audit_log
- [ ] `/admin/finances`: summary cards add up; student table row matches the panel; CSV export downloads
- [ ] Payment failure: with a test subscription, retry a charge against decline card `4000 0000 0000 9995` (or use Stripe test clock/trial-end) → account flips Overdue and the alert email arrives at BILLING_ALERT_EMAILS

## 11. Reports

- [ ] Summary cards: overdue students / avg completion / late submissions look right for your data
- [ ] Weekly completion table matches reality for a spot-checked week
- [ ] Click a week title → per-week table: one row per student, one column per item, Done/Not done, reflection answers inline
- [ ] Cmd+F a student's name finds their row (whole table is on one page)

## 12. Group leader view

*As a group_leader account with an assigned group.*

- [ ] Logging in lands on the leader view (not the student dashboard)
- [ ] Sees only students in their own group; another group's student detail URL → not found
- [ ] Student detail shows per-week completion, read-only (no edit controls anywhere)

## 13. School year lifecycle

- [ ] Create a school year; set application window; open/close states reflect on `/apply`
- [ ] Complete the active year → students become alumni; alumni see only their past reflections page; excluded from weekly email
- [ ] Reopen year → alumni restored to students
- [ ] Activate a different year → all student-facing views switch to it

## 14. Dark mode (web)

- [ ] Account page (student) and Settings (admin) show the Light/Dark/System toggle
- [ ] Dark: page darker than cards, all text readable, inputs/placeholders legible, status chips (green/red/amber/blue) readable
- [ ] Choice survives reload with **no flash** of the wrong theme
- [ ] System + change the OS theme → app follows live
- [ ] Spot-check in dark: dashboard, curriculum editor, reports tables, finances, form builder, applicant form

## 15. Mobile app (Expo — light mode only for now)

- [ ] Log in as student; This Week lists items; checking one syncs to web
- [ ] Item detail: video plays; reading list renders; reflection response saves and completes the item
- [ ] Open tab: badge count matches incomplete items; completing one updates it
- [ ] History shows past weeks with on-time/late labels

## 16. Infrastructure

- [ ] Vercel → Cron Jobs → run `/api/keepalive` → 200 `ok` (no more Supabase pause emails)
- [ ] Stripe webhook events visible in `stripe listen` output during §3/§8 checkouts, each → 200
- [ ] Dependabot: repo → Insights → Dependency graph shows it enabled; PRs appear as updates release
- [ ] Audit log spot-check: impersonation, role change, billing actions, reference waiver all present with actor + timestamp

---

## Known gaps (expected failures — don't file these)

- Emails come from `onboarding@resend.dev` until the Resend domain is verified
- Stripe runs on the personal **test** account until go-live (plan.md §1)
- Mobile app has no dark mode yet, no Tuition tab, and no application flow (web-only features)
- CSV bulk import not built — transfers are one at a time for now
