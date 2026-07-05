// Shared types + logic for the application form builder.
// Used by the admin builder, the applicant renderer, and server validation —
// keep visibility/step semantics identical everywhere (docs/form-builder-spec.md).

export type FieldType =
  | 'header' | 'note' | 'short_text' | 'paragraph'
  | 'yes_no' | 'select' | 'checkbox_group'

export type AppField = {
  id: string
  school_year_id: string
  type: FieldType
  label: string
  help_text: string | null
  options: string[] | null
  required: boolean
  sort_order: number
  show_if_field_id: string | null
  show_if_value: string | null
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

/** Single-condition branching: equals for scalar answers, contains for checkbox groups. */
export function isVisible(field: AppField, answers: AnswerMap): boolean {
  if (!field.show_if_field_id || !field.show_if_value) return true
  const controlling = answers[field.show_if_field_id]
  if (controlling === undefined) return false
  if (Array.isArray(controlling)) return controlling.includes(field.show_if_value)
  return controlling === field.show_if_value
}

export function hasAnswer(value: string | string[] | undefined): boolean {
  if (value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  return value.trim().length > 0
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
