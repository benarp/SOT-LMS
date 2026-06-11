'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitReflection(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const bookId = formData.get('bookId') as string
  const content = formData.get('content') as string
  const file = formData.get('file') as File | null

  let fileUrl: string | null = null

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${bookId}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('reflections')
      .upload(path, file, { upsert: true })

    if (uploadError) throw new Error(uploadError.message)
    fileUrl = path
  }

  const { error } = await supabase.from('book_reflections').upsert({
    student_id: user.id,
    book_id: bookId,
    content: content || null,
    file_url: fileUrl,
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'student_id,book_id' })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/reflections')
}
