import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

export type OpenItem = {
  id: string
  type: string
  title: string
  description: string | null
  sort_order: number
}

export type OpenWeek = {
  id: string
  week_number: number
  title: string
  due_date: string
  isPastDue: boolean
  items: OpenItem[]
}

// Tiny external store so the tab badge updates from any screen
// without prop-drilling or a state library.
let openCount = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

export function setOpenCount(n: number) {
  openCount = n
  emit()
}

export function adjustOpenCount(delta: number) {
  openCount = Math.max(0, openCount + delta)
  emit()
}

export function useOpenCount(): number {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => openCount
  )
}

/**
 * Every incomplete homework item from weeks that are due or current
 * (future pre-loaded weeks are excluded). Grouped by week, oldest first.
 * Also refreshes the tab badge count.
 */
export async function fetchOpenAssignments(): Promise<{ weeks: OpenWeek[]; userId: string } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: schoolYear } = await supabase
    .from('school_years').select('id').eq('is_active', true).single()
  if (!schoolYear) { setOpenCount(0); return { weeks: [], userId: user.id } }

  // "Current" week matches the This Week screen: first week due within
  // the last 7 days or later. Everything due before that is past.
  const { data: currentWeek } = await supabase
    .from('weeks')
    .select('id, due_date')
    .eq('school_year_id', schoolYear.id)
    .gte('due_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('due_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  let weeksQuery = supabase
    .from('weeks')
    .select('id, week_number, title, due_date')
    .eq('school_year_id', schoolYear.id)
    .order('due_date', { ascending: true })

  if (currentWeek) {
    weeksQuery = weeksQuery.lte('due_date', currentWeek.due_date)
  } else {
    weeksQuery = weeksQuery.lt('due_date', new Date().toISOString())
  }

  const { data: weeks } = await weeksQuery
  if (!weeks || weeks.length === 0) { setOpenCount(0); return { weeks: [], userId: user.id } }

  const weekIds = weeks.map(w => w.id)
  const [{ data: items }, { data: subs }] = await Promise.all([
    supabase.from('homework_items')
      .select('id, week_id, type, title, description, sort_order')
      .in('week_id', weekIds)
      .order('sort_order'),
    supabase.from('submissions').select('homework_item_id').eq('student_id', user.id),
  ])

  const submittedIds = new Set((subs || []).map(s => s.homework_item_id))
  const now = new Date()

  const result: OpenWeek[] = weeks
    .map(w => ({
      id: w.id,
      week_number: w.week_number,
      title: w.title,
      due_date: w.due_date,
      isPastDue: new Date(w.due_date) < now,
      items: (items || [])
        .filter(i => i.week_id === w.id && !submittedIds.has(i.id))
        .map(({ week_id, ...rest }) => rest),
    }))
    .filter(w => w.items.length > 0)

  setOpenCount(result.reduce((sum, w) => sum + w.items.length, 0))
  return { weeks: result, userId: user.id }
}
