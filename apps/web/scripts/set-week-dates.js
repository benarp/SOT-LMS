// Rewrites the due dates for every week of a school year.
//
// The school meets Tuesdays. The calendar is generated from a start date plus
// an explicit list of Tuesdays with no class, rather than stored as 32 literal
// dates — that way the breaks are self-documenting and a mistake shows up as a
// wrong holiday rather than an off-by-one date.
//
// Usage (from apps/web):
//   node scripts/set-week-dates.js --dry-run
//   node scripts/set-week-dates.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SCHOOL_YEAR = '2026-2027'

// Week 1. Every meeting is the Tuesday this lands on.
const FIRST_DUE = '2026-09-08'

// Tuesdays with no class. Skipped when numbering the weeks.
const BREAKS = {
  '2026-11-24': 'Thanksgiving week',
  '2026-12-22': 'Christmas',
  '2026-12-29': 'New Year',
  '2027-03-23': 'Spring break',
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Due dates for weeks 1..count, skipping BREAKS. */
function calendar(count) {
  const dates = []
  let d = FIRST_DUE
  while (dates.length < count) {
    if (!BREAKS[d]) dates.push(d)
    d = addDays(d, 7)
  }
  return dates
}

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
  const dryRun = process.argv.includes('--dry-run')
  const env = loadEnvLocal()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: year } = await admin
    .from('school_years').select('id, name').eq('name', SCHOOL_YEAR).single()
  if (!year) { console.error(`No school year named "${SCHOOL_YEAR}"`); process.exit(1) }

  const { data: weeks } = await admin
    .from('weeks').select('id, week_number, title, due_date')
    .eq('school_year_id', year.id).order('week_number')
  if (!weeks?.length) { console.error(`No weeks in ${year.name}`); process.exit(1) }

  const dates = calendar(Math.max(...weeks.map(w => w.week_number)))
  console.log(`${year.name} · ${weeks.length} week(s)${dryRun ? '  (DRY RUN — no writes)' : ''}\n`)

  let changed = 0
  for (const w of weeks) {
    const want = dates[w.week_number - 1]
    const have = String(w.due_date).slice(0, 10)
    if (have === want) { console.log(`Week ${String(w.week_number).padStart(2)}  ${want}  (unchanged)`); continue }
    console.log(`Week ${String(w.week_number).padStart(2)}  ${have} → ${want}`)
    changed++
    if (dryRun) continue
    const { error } = await admin.from('weeks').update({ due_date: want }).eq('id', w.id)
    if (error) { console.error(`  UPDATE FAILED: ${error.message}`); process.exit(1) }
  }

  console.log('\nBreaks (no class):')
  for (const [d, why] of Object.entries(BREAKS)) console.log(`  ${d}  ${why}`)
  console.log(dryRun ? `\nDRY RUN — ${changed} week(s) would change.` : `\nDone — ${changed} week(s) updated.`)
}

main().catch(e => { console.error(e); process.exit(1) })
