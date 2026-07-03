'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markComplete(homeworkItemId: string, weekDueDate: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const isLate = new Date(weekDueDate) < new Date()

  const { error } = await supabase.from('submissions').upsert({
    student_id: user.id,
    homework_item_id: homeworkItemId,
    is_late: isLate,
    completed_at: new Date().toISOString(),
  }, { onConflict: 'student_id,homework_item_id' })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard', 'layout')
}

export async function submitReflection(
  homeworkItemId: string,
  weekDueDate: string,
  responseText: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!responseText.trim()) return { error: 'Write something before saving.' }

  const isLate = new Date(weekDueDate) < new Date()

  const { error } = await supabase.from('submissions').upsert({
    student_id: user.id,
    homework_item_id: homeworkItemId,
    is_late: isLate,
    completed_at: new Date().toISOString(),
    response_text: responseText.trim(),
  }, { onConflict: 'student_id,homework_item_id' })

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return {}
}

export async function markIncomplete(homeworkItemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('submissions')
    .delete()
    .eq('student_id', user.id)
    .eq('homework_item_id', homeworkItemId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard', 'layout')
}
