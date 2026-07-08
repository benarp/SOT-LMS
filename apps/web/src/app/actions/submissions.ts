'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const UPLOAD_BUCKET = 'homework-uploads'

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
  if (!responseText.trim()) return { error: 'Type your response or add a photo — either one works.' }

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

/**
 * Record an uploaded journal photo/PDF on the submission. The file itself is
 * uploaded straight to Storage by the browser (RLS limits students to their
 * own uid/ folder); this action snapshots it on the submission and cleans up
 * any previously attached file.
 */
export async function saveReflectionFile(
  homeworkItemId: string,
  weekDueDate: string,
  filePath: string,
  fileName: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // The client controls filePath — never accept a path outside their folder
  if (!filePath.startsWith(`${user.id}/`)) return { error: 'Invalid file path' }

  const { data: existing } = await supabase
    .from('submissions')
    .select('response_file_path')
    .eq('student_id', user.id)
    .eq('homework_item_id', homeworkItemId)
    .maybeSingle()

  const isLate = new Date(weekDueDate) < new Date()
  const { error } = await supabase.from('submissions').upsert({
    student_id: user.id,
    homework_item_id: homeworkItemId,
    is_late: isLate,
    completed_at: new Date().toISOString(),
    response_file_path: filePath,
    response_file_name: fileName,
  }, { onConflict: 'student_id,homework_item_id' })
  if (error) return { error: error.message }

  // Replaced an earlier upload — remove the orphaned file
  if (existing?.response_file_path && existing.response_file_path !== filePath) {
    await createAdminClient().storage.from(UPLOAD_BUCKET)
      .remove([existing.response_file_path]).catch(() => null)
  }

  revalidatePath('/dashboard', 'layout')
  return {}
}

export async function removeReflectionFile(homeworkItemId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, response_text, response_file_path')
    .eq('student_id', user.id)
    .eq('homework_item_id', homeworkItemId)
    .maybeSingle()
  if (!submission) return {}

  if (submission.response_file_path) {
    await createAdminClient().storage.from(UPLOAD_BUCKET)
      .remove([submission.response_file_path]).catch(() => null)
  }

  // Without a typed response the item is no longer answered at all
  if (submission.response_text?.trim()) {
    const { error } = await supabase.from('submissions')
      .update({ response_file_path: null, response_file_name: null })
      .eq('id', submission.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('submissions').delete().eq('id', submission.id)
    if (error) return { error: error.message }
  }

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
