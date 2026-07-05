# Application Form Builder — Spec

**Status:** Approved July 2026 (decisions confirmed by Ben)
**Replaces:** the fixed 5-essay questionnaire + `application_settings` label editing

## Decisions
- **Field types (core set only):** `header` (section break), `note` (display text),
  `short_text`, `paragraph`, `yes_no`, `select`, `checkbox_group`. All questions support
  required + branching. More types (file upload, signature) can be added later.
- **Applicant UX:** sectioned steps with progress bar. `header` fields author the step
  breaks. Back/next navigation, answers autosaved (leave and resume), validation on
  Continue, explicit final Submit.
- **Rollout:** replaces the old questionnaire now. Each school year that has
  `application_settings` gets its form seeded from those 5 prompts + agreement text.
  Already-submitted applications stay readable (legacy columns still rendered).
- **Branching:** single condition — "show field when [earlier field] = [value]".
  Matches yes/no and select answers; checkbox groups match "answer contains value".

## What stays fixed (not part of the builder)
- Account creation, then **Contact step**: full name, phone, city — these map to real
  `applications` columns used elsewhere (admin tables, emails), so they're a hardcoded
  first step, always shown.
- Step 2 (pastoral reference) and the admin accept/decline flow are unchanged.

## Data model
```sql
application_fields (
  id uuid pk,
  school_year_id → school_years,
  type text check in ('header','note','short_text','paragraph','yes_no','select','checkbox_group'),
  label text,               -- question / header / note text
  help_text text,           -- optional hint under the label
  options jsonb,            -- string[] for select / checkbox_group
  required bool,
  sort_order int,
  show_if_field_id uuid → application_fields (null = always visible),
  show_if_value text
)

application_answers (
  id uuid pk,
  application_id → applications,
  field_id → application_fields,
  -- snapshot at answer time so later edits/deletes don't rewrite history:
  field_label text, field_type text, field_sort int,
  value jsonb,              -- string | string[] 
  unique (application_id, field_id)
)

applications + questionnaire_submitted_at timestamptz  -- new completion marker
```
RLS: fields readable by all authenticated, admin-write. Answers: applicant full access
to rows of their own applications; admin read.

## Behavior details
- **Steps:** fields between headers form a step; fields before the first header are an
  implicit first section. Hidden-by-branching fields don't count toward validation.
- **Autosave:** upsert one answer row per field (debounced client-side).
- **Submit:** server re-validates all *visible* required fields, sets
  `questionnaire_submitted_at`. `getApplicationStep` treats that timestamp (or the
  legacy 3-essays heuristic for old applications) as step-1 completion.
- **Branching answers left behind:** if an answer's controlling condition later becomes
  false, the stored answer is kept but ignored for validation and hidden from review.
- **Deleting a field with answers:** blocked (same pattern as homework items) — edit or
  hide it instead. Reordering is free; answers carry their own snapshot order.
- **Admin review:** application detail renders dynamic answers in snapshot order;
  applications with no dynamic answers fall back to the legacy essay columns.

## Out of scope (this pass)
- Multi-condition logic, file upload/signature fields, drag-and-drop reordering
  (up/down buttons instead), form preview mode, per-question analytics.
