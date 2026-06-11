import { createAdminClient } from '@/lib/supabase/admin'

export type AuditEntry = {
  actor_id: string
  actor_email?: string | null
  action: string
  target_type?: string
  target_id?: string
  detail?: Record<string, unknown>
}

/**
 * Best-effort audit logging. Never throws — a missing audit_log table
 * or transient DB error must not break the action being audited.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await createAdminClient().from('audit_log').insert(entry)
  } catch (err) {
    console.error('audit log insert failed:', err)
  }
}
