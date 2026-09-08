// Loads a "Journey Through the Bible" reading-plan PDF into homework_items.
//
// Structure comes from scripts/parse-reading-plan.js. Per week the PDF gives
// five survey readings (the Shorter plan) and one "ENTIRE BIBLE PLAN" line
// (the Whole Bible plan).
//
//   Shorter -> one item per day, five checkboxes, bible_plan='shorter'
//   Whole   -> a single item for the week, bible_plan='whole'
//
// The Whole plan is one item because the manual states the entire-Bible
// reading is deliberately undivided ("you will divide it as you desire").
// Inventing day boundaries for it across 18 weeks isn't something to guess at.
//
// Each item carries a BibleGateway link in external_url.
//
// PDF week N maps to school-year week N.
//
// Usage (from apps/web):
//   node scripts/load-reading-plan.js "/path/to/plan.pdf" --dry-run
//   node scripts/load-reading-plan.js "/path/to/plan.pdf"
//   node scripts/load-reading-plan.js "/path/to/plan.pdf" --weeks 1-6

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { parse, splitReferences, biblegatewayUrl } = require('./parse-reading-plan.js')

const SCHOOL_YEAR = '2026-2027'

/**
 * Corrections applied on top of what the PDF literally says.
 *
 * Kept as explicit overrides rather than folded into the parser so they stay
 * visible, and so re-running against a corrected PDF is a no-op rather than
 * silently re-applying a fix that's no longer needed.
 *
 * week 3 whole: the PDF reads "Job 18-42, John 3-4", repeating week 2's New
 * Testament reading. Every other week's Entire Bible line matches that week's
 * survey NT reading (17/18), and John 5-6 appears in no Entire Bible line at
 * all — so a whole-Bible reader would read John 3-4 twice and skip John 5-6.
 * Confirmed with Ben 2026-09-08; also flagged in docs/reading-plan-part-one.md
 * for the next revision of the PDF.
 */
const OVERRIDES = {
  3: { whole: 'Job 18-42, John 5-6' },
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

function desiredItems(week) {
  const items = []
  for (const day of week.shorter) {
    items.push({
      type: 'bible_reading',
      title: `Day ${day.day}`,
      description: null,
      content: splitReferences(day.reference).join('\n'),
      external_url: day.url,
      bible_plan: 'shorter',
      sort_order: items.length,
    })
  }
  if (week.whole) {
    items.push({
      type: 'bible_reading',
      title: 'Entire Bible Plan',
      description: 'Read at your own pace across the week.',
      content: splitReferences(week.whole.reference).join('\n'),
      external_url: week.whole.url,
      bible_plan: 'whole',
      sort_order: items.length,
    })
  }
  return items
}

function sameAsExisting(existing, desired) {
  if (existing.length !== desired.length) return false
  return desired.every((d, i) => {
    const e = existing[i]
    return e && e.title === d.title && e.content === d.content &&
      e.description === d.description && e.bible_plan === d.bible_plan &&
      e.external_url === d.external_url && e.sort_order === d.sort_order
  })
}

function parseWeekFilter(arg) {
  if (!arg) return null
  const m = arg.match(/^(\d+)(?:-(\d+))?$/)
  if (!m) return null
  const from = Number(m[1])
  const to = m[2] ? Number(m[2]) : from
  return n => n >= from && n <= to
}

async function main() {
  const pdfPath = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')
  const weeksArgIndex = process.argv.indexOf('--weeks')
  const weekFilter = parseWeekFilter(weeksArgIndex > -1 ? process.argv[weeksArgIndex + 1] : null)

  if (!pdfPath || pdfPath.startsWith('--')) {
    console.error('Usage: node scripts/load-reading-plan.js <plan.pdf> [--dry-run] [--weeks 1-6]')
    process.exit(1)
  }

  const parsed = parse(pdfPath)
    .filter(w => !weekFilter || weekFilter(w.week))
    .map(w => {
      const override = OVERRIDES[w.week]
      if (!override?.whole) return w
      if (w.whole && w.whole.reference === override.whole) return w // PDF already fixed
      console.log(`  ↳ week ${w.week}: overriding Entire Bible Plan`)
      console.log(`      PDF says : ${w.whole ? w.whole.reference : '(none)'}`)
      console.log(`      using    : ${override.whole}`)
      return { ...w, whole: { reference: override.whole, url: biblegatewayUrl(override.whole) } }
    })
  const env = loadEnvLocal()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: year } = await admin
    .from('school_years').select('id, name').eq('name', SCHOOL_YEAR).single()
  if (!year) { console.error(`No school year named "${SCHOOL_YEAR}"`); process.exit(1) }

  const { data: weeks } = await admin
    .from('weeks').select('id, week_number, due_date').eq('school_year_id', year.id)

  console.log(`${year.name} · ${parsed.length} week(s) from ${path.basename(pdfPath)}${dryRun ? '  (DRY RUN — no writes)' : ''}\n`)

  let changed = 0, skipped = 0
  for (const pw of parsed) {
    const week = (weeks ?? []).find(w => w.week_number === pw.week)
    if (!week) { console.error(`Week ${pw.week}: not in ${year.name} — skipped`); skipped++; continue }

    const { data: allItems } = await admin
      .from('homework_items')
      .select('id, type, title, description, content, external_url, bible_plan, sort_order')
      .eq('week_id', week.id).order('sort_order')

    const existingReadings = (allItems ?? []).filter(i => i.type === 'bible_reading')
    const otherItems = (allItems ?? []).filter(i => i.type !== 'bible_reading')
    const desired = desiredItems(pw)

    const flag = pw.ok ? '' : `  ⚠ ${pw.dayCount} day(s) in source`
    console.log(`Week ${pw.week} — due ${String(week.due_date).slice(0, 10)} — ${desired.length} item(s)${flag}`)
    for (const d of desired) {
      console.log(`  [${d.sort_order}] ${d.title}  (${d.bible_plan})`)
      for (const line of d.content.split('\n')) console.log(`        • ${line}`)
    }

    if (sameAsExisting(existingReadings, desired)) { console.log('  (already up to date)\n'); continue }

    if (existingReadings.length > 0) {
      const { count } = await admin
        .from('submissions').select('*', { count: 'exact', head: true })
        .in('homework_item_id', existingReadings.map(i => i.id))
      if (count && count > 0) {
        console.error(`  SKIPPED — ${count} submission(s) exist on this week's scripture items; refusing to delete them.\n`)
        skipped++
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
      .from('homework_items').insert(desired.map(d => ({ ...d, week_id: week.id })))
    if (insertError) { console.error(`  INSERT FAILED: ${insertError.message}`); process.exit(1) }

    for (let i = 0; i < otherItems.length; i++) {
      await admin.from('homework_items')
        .update({ sort_order: desired.length + i }).eq('id', otherItems[i].id)
    }
    console.log('  updated\n')
  }

  console.log(dryRun
    ? `DRY RUN — ${changed} week(s) would change, ${skipped} skipped.`
    : `Done — ${changed} week(s) updated, ${skipped} skipped.`)
}

main().catch(e => { console.error(e); process.exit(1) })
