/**
 * Per-student Bible reading plan (Shorter vs Whole Bible).
 *
 * A student's plan for a given week is `student_week_plans[week] ?? profiles.bible_plan`.
 * Rows only exist in student_week_plans for weeks that were frozen when the student
 * changed their setting (see migration-bible-plan.sql) — everything else follows their
 * current preference.
 *
 * Every place that reads homework_items for a student must filter through here, or
 * completion counts silently include the other plan's items.
 */

export type BiblePlan = 'shorter' | 'whole'

export const DEFAULT_BIBLE_PLAN: BiblePlan = 'shorter'

export const BIBLE_PLAN_LABELS: Record<BiblePlan, string> = {
  shorter: 'Shorter Plan',
  whole: 'Whole Bible Plan',
}

/** Item tag options as shown to admins when authoring a bible_reading item. */
export const BIBLE_PLAN_TAG_LABELS: Record<string, string> = {
  both: 'Both plans',
  shorter: 'Shorter Plan only',
  whole: 'Whole Bible Plan only',
}

export function isBiblePlan(value: unknown): value is BiblePlan {
  return value === 'shorter' || value === 'whole'
}

export function asBiblePlan(value: unknown): BiblePlan {
  return isBiblePlan(value) ? value : DEFAULT_BIBLE_PLAN
}

/** Minimal shape needed to decide visibility — real items carry many more fields. */
export type PlanTaggedItem = { week_id?: string | null; bible_plan?: string | null }

/**
 * Resolves each student's plan per week. `frozen` comes from student_week_plans;
 * anything not frozen falls back to the student's current preference.
 */
export function planForWeek(
  weekId: string | null | undefined,
  currentPlan: BiblePlan,
  frozen?: Map<string, BiblePlan> | null
): BiblePlan {
  if (!weekId || !frozen) return currentPlan
  return frozen.get(weekId) ?? currentPlan
}

/**
 * True if this item should be visible to a student on `plan`.
 * Untagged items (bible_plan null) are shown to everyone.
 */
export function itemVisibleToPlan(item: PlanTaggedItem, plan: BiblePlan): boolean {
  return item.bible_plan == null || item.bible_plan === plan
}

/**
 * Filters a list of items to those the student should see, resolving each item's
 * week against the frozen history. Items without a week_id are treated as
 * belonging to `fallbackWeekId` (used by single-week views that don't select it).
 */
export function visibleItems<T extends PlanTaggedItem>(
  items: T[] | null | undefined,
  currentPlan: BiblePlan,
  frozen?: Map<string, BiblePlan> | null,
  fallbackWeekId?: string | null
): T[] {
  return (items ?? []).filter(item =>
    itemVisibleToPlan(item, planForWeek(item.week_id ?? fallbackWeekId, currentPlan, frozen))
  )
}

/** Row shape returned by a student_week_plans select. */
type FrozenRow = { week_id: string; plan: string; student_id?: string }

/** Builds a weekId → plan map for one student. */
export function frozenMap(rows: FrozenRow[] | null | undefined): Map<string, BiblePlan> {
  const map = new Map<string, BiblePlan>()
  for (const row of rows ?? []) {
    if (isBiblePlan(row.plan)) map.set(row.week_id, row.plan)
  }
  return map
}

/** Builds studentId → (weekId → plan) for multi-student views (leader/admin reports). */
export function frozenMapByStudent(
  rows: (FrozenRow & { student_id: string })[] | null | undefined
): Map<string, Map<string, BiblePlan>> {
  const byStudent = new Map<string, Map<string, BiblePlan>>()
  for (const row of rows ?? []) {
    if (!isBiblePlan(row.plan)) continue
    let inner = byStudent.get(row.student_id)
    if (!inner) {
      inner = new Map<string, BiblePlan>()
      byStudent.set(row.student_id, inner)
    }
    inner.set(row.week_id, row.plan)
  }
  return byStudent
}

/**
 * Counts how many of `items` a given student can see — the correct denominator
 * for any "X of Y complete" figure. Replaces plan-blind `items.length`.
 */
export function visibleCountForStudent(
  items: PlanTaggedItem[],
  currentPlan: BiblePlan,
  frozen?: Map<string, BiblePlan> | null,
  fallbackWeekId?: string | null
): number {
  return visibleItems(items, currentPlan, frozen, fallbackWeekId).length
}
