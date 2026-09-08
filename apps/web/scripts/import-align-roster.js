// One-off script: import the Align student roster CSV into Supabase.
//
// For each row, creates an auth user + profile (role: student), sets
// full_name/birthday/phone/gender, and sends a password-setup email —
// same mechanics as createStudentAccount()/sendPasswordSetupEmail() in
// apps/web/src/app/actions/admin.ts, just run in bulk from a script.
//
// No group/leader assignment and no Stripe linking — both are being done
// separately.
//
// Usage:
//   node scripts/import-align-roster.js /path/to/roster.csv --dry-run
//   node scripts/import-align-roster.js /path/to/roster.csv
//
// Run from apps/web/. Reads Supabase config from .env.local.

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

// Minimal CSV parser (handles quoted fields with embedded commas; no escaped-quote support needed for this file)
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }

  const header = rows[0].map(h => h.trim())
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

function parseBirthdate(str) {
  // "Apr 14, 1997" -> "1997-04-14" — parsed manually to avoid Date/timezone
  // shifting the day.
  const m = /^(\w{3})\s+(\d{1,2}),\s*(\d{4})$/.exec(str.trim())
  if (!m) return null
  const [, mon, day, year] = m
  const month = MONTHS[mon]
  if (!month) return null
  return `${year}-${month}-${day.padStart(2, '0')}`
}

async function main() {
  const csvPath = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  if (!csvPath) {
    console.error('Usage: node scripts/import-align-roster.js /path/to/roster.csv [--dry-run]')
    process.exit(1)
  }

  const env = loadEnvLocal()
  const siteUrl = env.NEXT_PUBLIC_SITE_URL || 'https://schooloftransformation.app'
  const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  console.log(`Parsed ${rows.length} rows from ${csvPath}${dryRun ? ' (DRY RUN — no writes, no emails)' : ''}\n`)

  const results = { created: [], skipped: [], failed: [] }

  for (const row of rows) {
    const email = (row.Email || '').trim().toLowerCase()
    const fullName = [row['First Name'], row['Last Name']].map(s => (s || '').trim()).filter(Boolean).join(' ')
    const phone = (row.Phone || '').trim() || null
    const gender = (row.Gender || '').trim() || null
    const birthday = row.Birthdate ? parseBirthdate(row.Birthdate) : null

    if (!email || !fullName) {
      results.failed.push({ email: email || '(none)', reason: 'missing email or name' })
      continue
    }

    if (dryRun) {
      console.log(`[dry-run] would create: ${fullName} <${email}> phone=${phone} gender=${gender} birthday=${birthday}`)
      results.created.push({ email, fullName })
      continue
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (error) {
      if (/already|exists|registered/i.test(error.message)) {
        results.skipped.push({ email, reason: 'account already exists' })
      } else {
        results.failed.push({ email, reason: error.message })
      }
      continue
    }

    const userId = data.user.id

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ full_name: fullName, role: 'student', birthday, phone, gender })
      .eq('id', userId)

    if (profileError) {
      results.failed.push({ email, reason: `created but profile update failed: ${profileError.message}` })
      continue
    }

    await adminClient.from('audit_log').insert({
      actor_id: null,
      actor_email: 'align-import-script',
      action: 'student_account_created',
      target_type: 'user',
      target_id: email,
      detail: { transfer: true, source: 'align_csv_import' },
    }).then(() => {}, () => {}) // best-effort, matches logAudit()'s never-throw behavior

    const { error: resetError } = await anonClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    })

    results.created.push({ email, fullName, emailSent: !resetError })
    console.log(`created: ${fullName} <${email}>${resetError ? ` (password-setup email FAILED: ${resetError.message})` : ' (password-setup email sent)'}`)
  }

  console.log('\n── Summary ──')
  console.log(`Created: ${results.created.length}`)
  console.log(`Skipped (already existed): ${results.skipped.length}`)
  for (const s of results.skipped) console.log(`  - ${s.email}: ${s.reason}`)
  console.log(`Failed: ${results.failed.length}`)
  for (const f of results.failed) console.log(`  - ${f.email}: ${f.reason}`)
}

main().catch(err => { console.error(err); process.exit(1) })
