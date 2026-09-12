import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'homework-uploads'
const TTL_SECONDS = 3600

// Journal uploads live in a private bucket, so every one needs a signed URL.
// Signing them in a single batched call matters on pages that span a whole
// school year, where signing one at a time would mean hundreds of round trips.
export async function signedUploadUrls(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))]
  const urls = new Map<string, string>()
  if (unique.length === 0) return urls

  const admin = createAdminClient()
  const { data } = await admin.storage.from(BUCKET).createSignedUrls(unique, TTL_SECONDS)

  for (const entry of data || []) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl)
  }
  return urls
}
