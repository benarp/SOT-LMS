// Loads the Shorter Bible Reading Plan into homework_items.
//
// Source: "SOT Student Manual 2024-2025" pp.11-22. The Align scrape never
// captured the readings (legacy_lesson_steps has no body column — its lesson 1
// is titled 'Bible Reading Plan PDF'), so the manual is the only source.
//
// Manual rows are keyed by 2024-25 dates; those are discarded and rows map
// sequentially onto this year's weeks. Readings are transcribed by hand —
// always review --dry-run output against the PDF before applying.
//
// Updates the existing placeholder item in place so its id (and therefore any
// submissions already attached) survives.
//
// Usage (from apps/web):
//   node scripts/load-reading-plan.js --dry-run
//   node scripts/load-reading-plan.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SCHOOL_YEAR = '2026-2027'

// weekNumber -> the five day lines. Add weeks here as they're transcribed;
// anything absent is left untouched.
const READINGS = {
  1: {
    // Manual row 1 (dated 8/27), CREATION ERA
    title: 'Bible Reading — Week 1',
    days: [
      'Day 1: John 1-2',
      'Day 2: Genesis 1; Genesis 2; Genesis 3',
      'Day 3: Genesis 4:1-16, 25-26; Genesis 5:1; Genesis 6:9-22; Genesis 7:7-24',
      'Day 4: Genesis 8; Genesis 9:8-17',
      'Day 5: Genesis 11:1-9; Job 1',
    ],
  },
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

  const weekNumbers = Object.keys(READINGS).map(Number).sort((a, b) => a - b)
  const { data: weeks } = await admin
    .from('weeks').select('id, week_number, title, due_date')
    .eq('school_year_id', year.id).in('week_number', weekNumbers)

  console.log(`${year.name} · ${weekNumbers.length} week(s) to load${dryRun ? '  (DRY RUN — no writes)' : ''}\n`)

  let changed = 0
  for (const weekNumber of weekNumbers) {
    const week = (weeks ?? []).find(w => w.week_number === weekNumber)
    if (!week) { console.error(`  Week ${weekNumber}: NOT FOUND in ${year.name} — skipped`); continue }

    const { data: items } = await admin
      .from('homework_items')
      .select('id, title, description, content, bible_plan')
      .eq('week_id', week.id)
      .eq('type', 'bible_reading')
      .order('sort_order')

    if (!items || items.length === 0) {
      console.error(`  Week ${weekNumber}: no bible_reading item — skipped`)
      continue
    }
    if (items.length > 1) {
      console.error(`  Week ${weekNumber}: ${items.length} bible_reading items found; expected 1 — skipped to avoid picking the wrong one`)
      continue
    }

    const item = items[0]
    const plan = READINGS[weekNumber]
    const content = plan.days.join('\n')

    const same = item.title === plan.title && item.content === content &&
      item.description === null && item.bible_plan === 'shorter'

    console.log(`Week ${weekNumber} — due ${String(week.due_date).slice(0, 10)}`)
    console.log(`  before: ${JSON.stringify(item.title)} | plan=${item.bible_plan ?? 'null'} | desc=${item.description ? JSON.stringify(item.description.slice(0, 40)) : 'null'}`)
    for (const line of (item.content ?? '').split('\n').filter(Boolean)) console.log(`          ${line}`)
    console.log(`  after:  ${JSON.stringify(plan.title)} | plan=shorter | desc=null`)
    for (const line of plan.days) console.log(`          ${line}`)

    if (same) { console.log('  (already up to date)\n'); continue }
    changed++

    if (!dryRun) {
      const { error } = await admin
        .from('homework_items')
        .update({ title: plan.title, description: null, content, bible_plan: 'shorter' })
        .eq('id', item.id)
      if (error) { console.error(`  UPDATE FAILED: ${error.message}\n`); process.exit(1) }
      console.log('  updated\n')
    } else {
      console.log('')
    }
  }

  console.log(dryRun
    ? `DRY RUN — ${changed} item(s) would change. Check the readings against the PDF before applying.`
    : `Done — ${changed} item(s) updated.`)
}

main().catch(e => { console.error(e); process.exit(1) })
