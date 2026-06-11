'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function generateImpersonationLink(studentEmail: string): Promise<string> {
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: studentEmail,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://sot-lms.vercel.app'}/auth/callback?impersonating=true`,
    },
  })

  if (error) throw new Error(error.message)
  return data.properties.action_link
}
