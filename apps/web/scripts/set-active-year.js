// One-off: make a single school year the active one.
//
// Mirrors the flag-flipping half of setActiveSchoolYear() in
// app/actions/schoolYears.ts — deactivate every year, then activate the named
// one. Deliberately does NOT run that action's applicant-promotion step; role
// changes should be made deliberately, not as a side effect.
//
// Usage (from apps/web):
//   node scripts/set-active-year.js                 # show current state only
//   node scripts/set-active-year.js "2026-2027"     # activate that year

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

async function main() {
  const targetName = process.argv[2]
  const env = loadEnvLocal()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const show = async (label) => {
    const { data } = await admin
      .from('school_years')
      .select('id, name, start_date, end_date, is_active, completed_at')
      .order('start_date')
    console.log(`\n${label}`)
    for (const y of data ?? []) {
      const flags = [y.is_active ? 'ACTIVE' : 'inactive', y.completed_at ? 'completed' : null]
        .filter(Boolean).join(', ')
      console.log(`  ${y.name.padEnd(14)} ${String(y.start_date).slice(0, 10)} → ${String(y.end_date).slice(0, 10)}  [${flags}]`)
    }
    return data ?? []
  }

  const years = await show('Current state:')

  if (!targetName) {
    console.log('\nNo year name given — nothing changed. Pass a name to activate it.')
    return
  }

  const target = years.find(y => y.name === targetName)
  if (!target) {
    console.error(`\nNo school year named "${targetName}". Names above are exact.`)
    process.exit(1)
  }

  const { error: offError } = await admin
    .from('school_years').update({ is_active: false }).neq('id', target.id)
  if (offError) { console.error('Deactivate failed:', offError.message); process.exit(1) }

  const { error: onError } = await admin
    .from('school_years').update({ is_active: true }).eq('id', target.id)
  if (onError) { console.error('Activate failed:', onError.message); process.exit(1) }

  await show('After:')
}

main().catch(e => { console.error(e); process.exit(1) })
