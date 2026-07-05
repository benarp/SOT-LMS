'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addApplicationField, updateApplicationField, deleteApplicationField, reorderApplicationFields,
} from '@/app/actions/applicationForm'
import {
  type AppField, type FieldType, FIELD_TYPE_LABELS, BRANCH_SOURCE_TYPES, isAnswerable,
} from '@/lib/applicationForm'
import QuestionnaireForm from '@/app/apply/questionnaire/QuestionnaireForm'

const HAS_OPTIONS: FieldType[] = ['select', 'checkbox_group']

type FieldWithCount = AppField & { answer_count: number }

function branchValueChoices(source: AppField | undefined): string[] {
  if (!source) return []
  if (source.type === 'yes_no') return ['Yes', 'No']
  return source.options ?? []
}

function FieldEditor({
  field, schoolYearId, branchSources, onDone,
}: {
  field: AppField | null // null = new field
  schoolYearId: string
  branchSources: AppField[]
  onDone: () => void
}) {
  const [type, setType] = useState<FieldType>(field?.type ?? 'short_text')
  const [showIfFieldId, setShowIfFieldId] = useState(field?.show_if_field_id ?? '')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const source = branchSources.find(f => f.id === showIfFieldId)
  const valueChoices = branchValueChoices(source)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = field ? await updateApplicationField(fd) : await addApplicationField(fd)
      if (result.error) { setError(result.error); return }
      onDone()
      router.refresh()
    })
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900'

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-3">
      {field
        ? <input type="hidden" name="fieldId" value={field.id} />
        : <input type="hidden" name="schoolYearId" value={schoolYearId} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          {field ? (
            <p className="px-3 py-2 text-sm text-gray-500 bg-white border border-gray-100 rounded-lg">{FIELD_TYPE_LABELS[field.type]}</p>
          ) : (
            <select name="type" value={type} onChange={e => setType(e.target.value as FieldType)} className={`${inputClass} bg-white`}>
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map(t => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </select>
          )}
        </div>
        {isAnswerable(field?.type ?? type) && (
          <label className="flex items-end gap-2 text-sm text-gray-600 pb-2 cursor-pointer">
            <input type="checkbox" name="required" defaultChecked={field?.required ?? true} className="rounded border-gray-300" />
            Required
          </label>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {(field?.type ?? type) === 'header' ? 'Section title' : (field?.type ?? type) === 'note' ? 'Note text' : 'Question'}
        </label>
        <textarea name="label" required rows={2} defaultValue={field?.label ?? ''} className={`${inputClass} resize-y`} />
      </div>

      {isAnswerable(field?.type ?? type) && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hint <span className="text-gray-400">(optional, shows under the question)</span></label>
          <input name="helpText" defaultValue={field?.help_text ?? ''} className={inputClass} />
        </div>
      )}

      {HAS_OPTIONS.includes(field?.type ?? type) && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Options <span className="text-gray-400">(one per line)</span></label>
          <textarea name="options" rows={4} required defaultValue={(field?.options ?? []).join('\n')} className={`${inputClass} resize-y font-mono`} />
        </div>
      )}

      {isAnswerable(field?.type ?? type) && branchSources.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Only show when <span className="text-gray-400">(optional)</span></label>
            <select name="showIfFieldId" value={showIfFieldId} onChange={e => setShowIfFieldId(e.target.value)} className={`${inputClass} bg-white`}>
              <option value="">Always shown</option>
              {branchSources.map(f => <option key={f.id} value={f.id}>{f.label.slice(0, 60)}</option>)}
            </select>
          </div>
          {showIfFieldId && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">…is answered</label>
              <select name="showIfValue" defaultValue={field?.show_if_value ?? ''} required className={`${inputClass} bg-white`}>
                <option value="">Choose an answer…</option>
                {valueChoices.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
          {pending ? 'Saving…' : field ? 'Save changes' : 'Add question'}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
      </div>
    </form>
  )
}

export default function FormBuilder({ fields: serverFields, schoolYearId }: { fields: FieldWithCount[]; schoolYearId: string }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  // Local copy so drag reorders render instantly; server refresh re-syncs it
  const [fields, setFields] = useState(serverFields)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => { setFields(serverFields) }, [serverFields])

  const branchSourcesBefore = (field: AppField | null) => {
    const idx = field ? fields.findIndex(f => f.id === field.id) : fields.length
    return fields.filter((f, i) => BRANCH_SOURCE_TYPES.includes(f.type) && f.id !== field?.id && i < idx)
  }

  function run(fn: () => Promise<{ error?: string }>) {
    setError('')
    startTransition(async () => {
      const result = await fn()
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  function handleDragEnter(overIndex: number) {
    if (dragIndex === null || dragIndex === overIndex) return
    setFields(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(overIndex, 0, moved)
      return next
    })
    setDragIndex(overIndex)
  }

  function handleDragEnd() {
    if (dragIndex === null) return
    setDragIndex(null)
    run(() => reorderApplicationFields(schoolYearId, fields.map(f => f.id)))
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-3">
        <button onClick={() => setPreviewing(true)}
          className="text-sm text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:border-gray-400 transition-colors">
          Preview form
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {(() => {
        // Group consecutive fields under their section header. Each group
        // renders as one boxed "step" — mirroring what applicants see.
        // Drag-and-drop still operates on the flat list via global indexes.
        const sections: { header: FieldWithCount | null; startIndex: number; rows: FieldWithCount[] }[] = []
        fields.forEach((f, i) => {
          if (f.type === 'header' || sections.length === 0) {
            sections.push({ header: f.type === 'header' ? f : null, startIndex: i, rows: [] })
          }
          if (f.type !== 'header') sections[sections.length - 1].rows.push(f)
        })

        const renderRow = (field: FieldWithCount, i: number) => (
          <div
            key={field.id}
            draggable={editingId !== field.id}
            onDragStart={e => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move' }}
            onDragEnter={() => handleDragEnter(i)}
            onDragOver={e => e.preventDefault()}
            onDragEnd={handleDragEnd}
            className={`bg-white border rounded-xl transition-shadow ${
              dragIndex === i ? 'opacity-60 shadow-lg border-gray-400' : 'border-gray-200'
            }`}
          >
            {editingId === field.id ? (
              <div className="p-2">
                <FieldEditor field={field} schoolYearId={schoolYearId} branchSources={branchSourcesBefore(field)} onDone={() => setEditingId(null)} />
              </div>
            ) : (
              <div className="flex items-start gap-2 px-3 py-3">
                <span className="flex-shrink-0 mt-1 text-gray-300 cursor-grab active:cursor-grabbing select-none px-1" aria-hidden>⠿</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">
                    {FIELD_TYPE_LABELS[field.type]}
                    {field.required && isAnswerable(field.type) && <span className="text-red-400"> · required</span>}
                    {field.show_if_field_id && <span className="text-blue-500"> · conditional</span>}
                    {field.answer_count > 0 && <span> · {field.answer_count} answer{field.answer_count === 1 ? '' : 's'}</span>}
                  </p>
                  <p className="text-sm mt-0.5 font-medium text-gray-800">{field.label}</p>
                  {field.help_text && <p className="text-xs text-gray-400 mt-0.5">{field.help_text}</p>}
                  {field.options && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{field.options.join(' · ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setEditingId(field.id); setAdding(false) }}
                    className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1">Edit</button>
                  <button
                    onClick={() => { if (confirm(`Delete "${field.label.slice(0, 60)}"?`)) run(() => deleteApplicationField(field.id)) }}
                    disabled={pending}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-2.5 py-1 disabled:opacity-50">
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )

        return sections.map((section, sIdx) => (
          <div key={section.header?.id ?? `pre-${sIdx}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-2 mb-4">
            {/* Section header band */}
            {section.header ? (
              <div
                draggable={editingId !== section.header.id}
                onDragStart={e => { setDragIndex(section.startIndex); e.dataTransfer.effectAllowed = 'move' }}
                onDragEnter={() => handleDragEnter(section.startIndex)}
                onDragOver={e => e.preventDefault()}
                onDragEnd={handleDragEnd}
                className={`rounded-xl transition-shadow ${dragIndex === section.startIndex ? 'opacity-60 shadow-lg' : ''}`}
              >
                {editingId === section.header.id ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-2">
                    <FieldEditor field={section.header} schoolYearId={schoolYearId} branchSources={branchSourcesBefore(section.header)} onDone={() => setEditingId(null)} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-gray-900 text-white rounded-xl px-3 py-2.5">
                    <span className="text-gray-500 cursor-grab active:cursor-grabbing select-none px-1" aria-hidden>⠿</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">Step {sIdx + 2} — Section</p>
                      <p className="text-sm font-semibold truncate">{section.header.label}</p>
                    </div>
                    <button onClick={() => { setEditingId(section.header!.id); setAdding(false) }}
                      className="text-xs text-gray-300 hover:text-white border border-gray-700 rounded-lg px-2.5 py-1">Edit</button>
                    <button
                      onClick={() => { if (confirm(`Delete section "${section.header!.label}"? Its questions move into the previous section.`)) run(() => deleteApplicationField(section.header!.id)) }}
                      disabled={pending}
                      className="text-xs text-red-300 hover:text-red-100 border border-gray-700 rounded-lg px-2.5 py-1 disabled:opacity-50">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] uppercase tracking-wider text-gray-400 px-1">
                Before the first section (shown on step 2 untitled)
              </p>
            )}

            {section.rows.map(field => renderRow(field, fields.findIndex(f => f.id === field.id)))}
            {section.rows.length === 0 && (
              <p className="text-xs text-gray-400 px-1 py-1">No questions in this section yet — drag some in or add below.</p>
            )}
          </div>
        ))
      })()}

      {fields.length === 0 && (
        <p className="text-sm text-gray-400 py-4">No questions yet — add your first one below.</p>
      )}

      {adding ? (
        <div className="bg-white border border-gray-200 rounded-xl p-2">
          <FieldEditor field={null} schoolYearId={schoolYearId} branchSources={branchSourcesBefore(null)} onDone={() => setAdding(false)} />
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setEditingId(null) }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors border border-dashed border-gray-300 rounded-xl px-4 py-3 w-full hover:border-gray-400">
          + Add question
        </button>
      )}

      {/* Preview: the real applicant component, persistence disabled */}
      {previewing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4 md:p-8"
          onClick={() => setPreviewing(false)}>
          <div className="w-full max-w-2xl my-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white">Preview — exactly what applicants see</p>
              <button onClick={() => setPreviewing(false)}
                className="text-sm text-white/80 hover:text-white bg-white/10 rounded-lg px-3 py-1.5">
                Close ✕
              </button>
            </div>
            <QuestionnaireForm
              key={fields.map(f => f.id).join(',')}
              fields={fields}
              initialAnswers={{}}
              contact={{ full_name: '', phone: '', city: '' }}
              schoolYearName="(preview)"
              preview
            />
          </div>
        </div>
      )}
    </div>
  )
}
