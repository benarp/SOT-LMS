// Shared types + logic for the application form builder.
// Used by the admin builder, the applicant renderer, and server validation —
// keep visibility/step semantics identical everywhere (docs/form-builder-spec.md).

export type FieldType =
  | 'header' | 'note' | 'short_text' | 'paragraph'
  | 'yes_no' | 'select' | 'checkbox_group'

export type FormKey = 'application' | 'wellness'

export type AppField = {
  id: string
  school_year_id: string
  form_key: FormKey
  type: FieldType
  label: string
  help_text: string | null
  options: string[] | null
  required: boolean
  sort_order: number
  show_if_field_id: string | null
  show_if_value: string | null
  /** Multi-value branching: when present, takes precedence over show_if_value (OR match). */
  show_if_values: string[] | null
  /** checkbox_group only: minimum/maximum number of options that must be selected. */
  min_select: number | null
  max_select: number | null
}

/** fieldId → answer. Strings for text/yes_no/select, string[] for checkbox groups. */
export type AnswerMap = Record<string, string | string[] | undefined>

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  header: 'Section header',
  note: 'Note (display only)',
  short_text: 'Short answer',
  paragraph: 'Paragraph answer',
  yes_no: 'Yes / No',
  select: 'Dropdown select',
  checkbox_group: 'Checkbox group',
}

export const ANSWERABLE_TYPES: FieldType[] = ['short_text', 'paragraph', 'yes_no', 'select', 'checkbox_group']

/** Types whose answers can drive branching conditions. */
export const BRANCH_SOURCE_TYPES: FieldType[] = ['yes_no', 'select', 'checkbox_group']

export function isAnswerable(type: FieldType): boolean {
  return ANSWERABLE_TYPES.includes(type)
}

/**
 * Branching: equals for scalar answers, contains for checkbox groups.
 * `show_if_values` (multi-value, OR match) takes precedence when present;
 * otherwise falls back to the single-value `show_if_value` for backward
 * compatibility with existing seeded/authored fields.
 */
export function isVisible(field: AppField, answers: AnswerMap): boolean {
  if (!field.show_if_field_id) return true
  const accepted = field.show_if_values && field.show_if_values.length > 0
    ? field.show_if_values
    : field.show_if_value ? [field.show_if_value] : null
  if (!accepted) return true

  const controlling = answers[field.show_if_field_id]
  if (controlling === undefined) return false
  if (Array.isArray(controlling)) return controlling.some(v => accepted.includes(v))
  return accepted.includes(controlling)
}

export function hasAnswer(value: string | string[] | undefined): boolean {
  if (value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  return value.trim().length > 0
}

/** checkbox_group fields whose selected-option count violates min_select/max_select. */
export function checkboxGroupCountErrors(fields: AppField[], answers: AnswerMap): AppField[] {
  return fields.filter(f => {
    if (f.type !== 'checkbox_group') return false
    if (!isVisible(f, answers)) return false
    if (f.min_select == null && f.max_select == null) return false
    const value = answers[f.id]
    const count = Array.isArray(value) ? value.length : 0
    // Only enforce bounds once the applicant has engaged with the question
    // (or the question is required — then 0 selections is also a bounds miss).
    if (count === 0 && !f.required) return false
    if (f.min_select != null && count < f.min_select) return true
    if (f.max_select != null && count > f.max_select) return true
    return false
  })
}

/** Human-readable selection-count constraint for UI hint text, e.g. "Choose 3–5". */
export function describeSelectConstraint(field: AppField): string | null {
  if (field.type !== 'checkbox_group') return null
  const { min_select: min, max_select: max } = field
  if (min == null && max == null) return null
  if (min != null && max != null) return min === max ? `Choose exactly ${min}` : `Choose ${min}–${max}`
  if (min != null) return `Choose at least ${min}`
  return `Choose at most ${max}`
}

export type FormStep = { title: string; fields: AppField[] }

/**
 * Header fields split the form into steps (the header's label is the step
 * title and it renders at the top of its step). Fields before the first
 * header become an implicit first step.
 */
export function groupIntoSteps(fields: AppField[]): FormStep[] {
  const steps: FormStep[] = []
  let current: FormStep | null = null
  for (const field of fields) {
    if (field.type === 'header') {
      current = { title: field.label, fields: [field] }
      steps.push(current)
    } else {
      if (!current) {
        current = { title: 'Getting started', fields: [] }
        steps.push(current)
      }
      current.fields.push(field)
    }
  }
  return steps
}

/** Visible required answerable fields that are missing an answer. */
export function missingRequired(fields: AppField[], answers: AnswerMap): AppField[] {
  return fields.filter(f =>
    isAnswerable(f.type) &&
    f.required &&
    isVisible(f, answers) &&
    !hasAnswer(answers[f.id])
  )
}

/**
 * Combined validation message for a set of fields (missing-required +
 * checkbox min/max violations) — used identically by the client
 * (QuestionnaireForm) and server actions (submitQuestionnaire /
 * submitWellnessSurvey) so the two never drift.
 */
export function stepErrors(fields: AppField[], answers: AnswerMap): string {
  const missing = missingRequired(fields, answers)
  const countErrors = checkboxGroupCountErrors(fields, answers)
  const messages: string[] = []

  if (missing.length === 1) messages.push(`Please answer: ${missing[0].label.slice(0, 80)}`)
  else if (missing.length > 1) messages.push(`${missing.length} required questions still need an answer.`)

  for (const f of countErrors) {
    const constraint = describeSelectConstraint(f)
    if (constraint) messages.push(`"${f.label.slice(0, 60)}" — ${constraint.toLowerCase()}.`)
  }

  return messages.join(' ')
}
