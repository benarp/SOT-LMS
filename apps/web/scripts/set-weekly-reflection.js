// Gives every week of the school year the same reflection question.
//
// The prompt is the same one every week ("Answer one or more of the
// following questions..."), so week 1's reflection item is the single source
// of truth and the rest are brought into line with it. Editing week 1 in the
// admin curriculum panel and re-running this propagates the change, rather
// than the text living in two places.
//
// Weeks are updated in place where a reflection already exists, so item ids —
// and any submissions attached to them — survive. Weeks with no reflection get
// one appended after their existing homework.
//
// Only weeks that already have homework are touched. The prompt asks about
// "this week's Bible Reading or video", so it means nothing on a week whose
// curriculum hasn't been loaded yet; those weeks get their reflection when
// their content lands.
//
// Usage (from apps/web):
//   node scripts/set-weekly-reflection.js --dry-run
//   node scripts/set-weekly-reflection.js
//   node scripts/set-weekly-reflection.js --weeks 2-6
//   node scripts/set-weekly-reflection.js --force   # rewrite prompts that have submissions

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SCHOOL_YEAR = '2026-2027'
const SOURCE_WEEK = 1
const TITLE = 'Reflection'

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

function parseWeekFilter(arg) {
  if (!arg) return null
  const m = arg.match(/^(\d+)(?:-(\d+))?$/)
  if (!m) return null
  const from = Number(m[1])
  const to = m[2] ? Number(m[2]) : from
  return n => n >= from && n <= to
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const force = process.argv.includes('--force')
  const wi = process.argv.indexOf('--weeks')
  const weekFilter = parseWeekFilter(wi > -1 ? process.argv[wi + 1] : null)

  const env = loadEnvLocal()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: year } = await admin
    .from('school_years').select('id, name').eq('name', SCHOOL_YEAR).single()
  if (!year) { console.error(`No school year named "${SCHOOL_YEAR}"`); process.exit(1) }

  const { data: weeks } = await admin
    .from('weeks').select('id, week_number, title').eq('school_year_id', year.id).order('week_number')

  const sourceWeek = (weeks ?? []).find(w => w.week_number === SOURCE_WEEK)
  if (!sourceWeek) { console.error(`Week ${SOURCE_WEEK} not found`); process.exit(1) }

  const { data: sourceItems } = await admin
    .from('homework_items').select('content').eq('week_id', sourceWeek.id).eq('type', 'reflection')
  if (!sourceItems || sourceItems.length !== 1) {
    console.error(`Week ${SOURCE_WEEK} must have exactly one reflection item to copy from; found ${sourceItems?.length ?? 0}`)
    process.exit(1)
  }
  const PROMPT = sourceItems[0].content
  console.log(`${year.name}${dryRun ? '  (DRY RUN — no writes)' : ''}`)
  console.log(`Prompt taken from week ${SOURCE_WEEK}:\n`)
  for (const line of PROMPT.split(/\r?\n/)) console.log(`    ${line}`)
  console.log('')

  let updated = 0, added = 0, same = 0, skipped = 0

  for (const week of weeks ?? []) {
    if (weekFilter && !weekFilter(week.week_number)) continue

    const { data: items } = await admin
      .from('homework_items')
      .select('id, type, title, description, content, sort_order')
      .eq('week_id', week.id).order('sort_order')

    const label = `Week ${String(week.week_number).padStart(2)}`
    if (!items || items.length === 0) {
      console.log(`${label}: no curriculum yet — left alone`)
      skipped++
      continue
    }

    const reflections = items.filter(i => i.type === 'reflection')
    if (reflections.length > 1) {
      console.error(`${label}: ${reflections.length} reflection items — needs a manual look, skipped`)
      skipped++
      continue
    }

    if (reflections.length === 1) {
      const r = reflections[0]
      if (r.title === TITLE && r.content === PROMPT && r.description === null) {
        console.log(`${label}: already up to date`)
        same++
        continue
      }
      const { count } = await admin
        .from('submissions').select('*', { count: 'exact', head: true }).eq('homework_item_id', r.id)
      if (count && count > 0 && !force) {
        console.error(`${label}: ${count} submission(s) already answered "${r.title}" — skipped (use --force to rewrite the prompt anyway)`)
        skipped++
        continue
      }
      console.log(`${label}: updating "${r.title}" -> "${TITLE}"${count ? `  (${count} existing submission(s) kept)` : ''}`)
      updated++
      if (dryRun) continue
      const { error } = await admin.from('homework_items')
        .update({ title: TITLE, content: PROMPT, description: null }).eq('id', r.id)
      if (error) { console.error(`  UPDATE FAILED: ${error.message}`); process.exit(1) }
      continue
    }

    const sortOrder = Math.max(...items.map(i => i.sort_order ?? 0)) + 1
    console.log(`${label}: adding "${TITLE}" at sort_order ${sortOrder}`)
    added++
    if (dryRun) continue
    const { error } = await admin.from('homework_items').insert({
      week_id: week.id,
      type: 'reflection',
      title: TITLE,
      description: null,
      content: PROMPT,
      external_url: null,
      sort_order: sortOrder,
    })
    if (error) { console.error(`  INSERT FAILED: ${error.message}`); process.exit(1) }
  }

  console.log(`\n${dryRun ? 'DRY RUN — ' : 'Done — '}${updated} updated, ${added} added, ${same} already correct, ${skipped} skipped.`)
}

main().catch(e => { console.error(e); process.exit(1) })
