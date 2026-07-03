import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('school_years').select('id').limit(1)

  if (error) {
    return new Response(`Ping failed: ${error.message}`, { status: 500 })
  }

  return new Response('ok')
}
