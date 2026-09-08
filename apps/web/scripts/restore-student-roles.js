// One-off repair: restore the 28 Align-imported students to role 'student'.
//
// "Complete this year" was run on the active (old) school year while the new
// cohort was already imported. The unscoped update in completeSchoolYear()
// graduated every role='student' profile, including students who had never
// attended. This restores exactly the imported roster, matched by email, so
// genuine prior-year alumni are untouched.
//
// Usage (from apps/web):
//   node scripts/restore-student-roles.js /path/to/roster.csv --dry-run
//   node scripts/restore-student-roles.js /path/to/roster.csv

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnvLocal() {
  const env = {}
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    env[t.slice(0, i).trim()] = v
  }
  return env
}

function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) { if (c === '"') inQuotes = false; else field += c }
    else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  const header = rows[0].map(h => h.trim())
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

async function main() {
  const csvPath = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  if (!csvPath) {
    console.error('Usage: node scripts/restore-student-roles.js /path/to/roster.csv [--dry-run]')
    process.exit(1)
  }

  const env = loadEnvLocal()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const emails = parseCsv(fs.readFileSync(csvPath, 'utf8'))
    .map(r => (r.Email || '').trim().toLowerCase())
    .filter(Boolean)

  const { data: current, error } = await admin
    .from('profiles')
    .select('id, full_name, email, role, alumni_year_id, group_id')
    .in('email', emails)
  if (error) { console.error('Lookup failed:', error.message); process.exit(1) }

  console.log(`Roster emails: ${emails.length} · matched profiles: ${(current ?? []).length}\n`)

  const byRole = {}
  for (const p of current ?? []) byRole[p.role] = (byRole[p.role] ?? 0) + 1
  console.log('Current roles:', byRole)

  const missing = emails.filter(e => !(current ?? []).some(p => (p.email || '').toLowerCase() === e))
  if (missing.length) console.log('\nNo profile found for:', missing)

  const needsFix = (current ?? []).filter(p => p.role !== 'student')
  console.log(`\nWould restore ${needsFix.length} profile(s) to role 'student':`)
  for (const p of needsFix) console.log(`  ${p.full_name || p.email} (${p.role} → student)`)

  if (needsFix.length === 0) { console.log('\nNothing to do — all already students.'); return }
  if (dryRun) { console.log('\nDRY RUN — no changes written.'); return }

  const { data: updated, error: updateError } = await admin
    .from('profiles')
    .update({ role: 'student', alumni_year_id: null })
    .in('id', needsFix.map(p => p.id))
    .select('email, role')
  if (updateError) { console.error('Update failed:', updateError.message); process.exit(1) }

  console.log(`\nRestored ${updated?.length ?? 0} profile(s).`)
}

main().catch(e => { console.error(e); process.exit(1) })
