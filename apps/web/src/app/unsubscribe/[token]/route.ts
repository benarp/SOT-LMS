import { createAdminClient } from '@/lib/supabase/admin'

function page(title: string, body: string) {
  return new Response(
    `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;max-width:380px;text-align:center;">
    <h1 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 8px 0;">${title}</h1>
    <p style="font-size:14px;color:#6b7280;margin:0;line-height:1.6;">${body}</p>
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return page('Invalid link', 'This unsubscribe link is not valid.')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .update({ email_opt_out: true })
    .eq('unsubscribe_token', token)
    .select('email')
    .maybeSingle()

  if (error || !data) {
    return page('Invalid link', 'This unsubscribe link is not valid or has already been used.')
  }

  return page(
    'You are unsubscribed',
    `${data.email} will no longer receive the weekly homework email. If this was a mistake, contact your school director.`
  )
}
