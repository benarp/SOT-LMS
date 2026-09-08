// Loads the Shorter Bible Reading Plan into homework_items.
//
// Source: "SOT Student Manual 2024-2025" pp.11-22. The Align scrape never
// captured the readings (legacy_lesson_steps has no body column — its lesson 1
// is titled 'Bible Reading Plan PDF'), so the manual is the only source.
//
// Each DAY becomes its own homework_item so students can tick days off
// individually. All five share the week's due date; the week's other items
// (video, reflection) are pushed after them in sort order.
//
// Manual rows are keyed by 2024-25 dates; those are discarded and rows map
// sequentially onto this year's weeks. Readings are transcribed by hand —
// always review --dry-run output against the PDF before applying.
//
// Usage (from apps/web):
//   node scripts/load-reading-plan.js --dry-run
//   node scripts/load-reading-plan.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SCHOOL_YEAR = '2026-2027'
const PLAN = 'shorter'

// weekNumber -> readings for days 1..5, verbatim from the manual's columns.
// A null entry means that day is blank in the manual (greyed-out cell).
// Add weeks here as they're transcribed; anything absent is left untouched.
const READINGS = {
  // Manual row 1 (dated 8/27), CREATION ERA
  1: [
    'John 1-2',
    'Genesis 1; Genesis 2; Genesis 3',
    'Genesis 4:1-16, 25-26; Genesis 5:1; Genesis 6:9-22; Genesis 7:7-24',
    'Genesis 8; Genesis 9:8-17',
    'Genesis 11:1-9; Job 1',
  ],
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

/**
 * One item (one checkbox) per day. Within a day, each scripture reference is
 * its own line so they render as a stacked bullet list on the card.
 */
function desiredItems(dayReadings) {
  const items = []
  dayReadings.forEach((refs, index) => {
    if (!refs) return // blank cell in the manual
    items.push({
      type: 'bible_reading',
      title: `Day ${index + 1}`,
      description: null,
      content: refs.split(';').map(r => r.trim()).filter(Boolean).join('\n'),
      bible_plan: PLAN,
      sort_order: index,
    })
  })
  return items
}

function sameAsExisting(existing, desired) {
  if (existing.length !== desired.length) return false
  return desired.every((d, i) => {
    const e = existing[i]
    return e && e.title === d.title && e.content === d.content &&
      e.description === d.description && e.bible_plan === d.bible_plan &&
      e.sort_order === d.sort_order
  })
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
    .from('weeks').select('id, week_number, due_date')
    .eq('school_year_id', year.id).in('week_number', weekNumbers)

  console.log(`${year.name} · ${weekNumbers.length} week(s)${dryRun ? '  (DRY RUN — no writes)' : ''}\n`)

  let changed = 0
  for (const weekNumber of weekNumbers) {
    const week = (weeks ?? []).find(w => w.week_number === weekNumber)
    if (!week) { console.error(`Week ${weekNumber}: NOT FOUND — skipped`); continue }

    const { data: allItems } = await admin
      .from('homework_items')
      .select('id, type, title, description, content, bible_plan, sort_order')
      .eq('week_id', week.id)
      .order('sort_order')

    const existingReadings = (allItems ?? []).filter(i => i.type === 'bible_reading')
    const otherItems = (allItems ?? []).filter(i => i.type !== 'bible_reading')
    const desired = desiredItems(READINGS[weekNumber])

    console.log(`Week ${weekNumber} — due ${String(week.due_date).slice(0, 10)}`)
    console.log(`  replacing ${existingReadings.length} scripture item(s) with ${desired.length} day item(s):`)
    for (const d of desired) {
      console.log(`    [${d.sort_order}] ${d.title}`)
      for (const line of d.content.split('\n')) console.log(`         • ${line}`)
    }
    if (otherItems.length) {
      console.log(`  other items shifted after: ${otherItems.map(i => `${i.title} → sort ${desired.length + otherItems.indexOf(i)}`).join(', ')}`)
    }

    if (sameAsExisting(existingReadings, desired)) { console.log('  (already up to date)\n'); continue }

    // Never destroy work: refuse if anything has been submitted against the
    // items we'd be removing.
    if (existingReadings.length > 0) {
      const { count } = await admin
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .in('homework_item_id', existingReadings.map(i => i.id))
      if (count && count > 0) {
        console.error(`  SKIPPED — ${count} submission(s) exist on the current scripture items; refusing to delete them.\n`)
        continue
      }
    }

    changed++
    if (dryRun) { console.log('') ; continue }

    if (existingReadings.length > 0) {
      const { error } = await admin.from('homework_items').delete().in('id', existingReadings.map(i => i.id))
      if (error) { console.error(`  DELETE FAILED: ${error.message}`); process.exit(1) }
    }

    const { error: insertError } = await admin
      .from('homework_items')
      .insert(desired.map(d => ({ ...d, week_id: week.id })))
    if (insertError) { console.error(`  INSERT FAILED: ${insertError.message}`); process.exit(1) }

    // Keep video/reflection after the day items
    for (let i = 0; i < otherItems.length; i++) {
      await admin.from('homework_items')
        .update({ sort_order: desired.length + i })
        .eq('id', otherItems[i].id)
    }

    console.log('  updated\n')
  }

  console.log(dryRun
    ? `DRY RUN — ${changed} week(s) would change. Check the readings against the PDF before applying.`
    : `Done — ${changed} week(s) updated.`)
}

main().catch(e => { console.error(e); process.exit(1) })
