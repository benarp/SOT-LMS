// Fills in the Bible Project video for each week of Part One.
//
// Weeks 1-2 were entered by hand; weeks 3-6 carried "TBD Video" placeholders
// with no link. Week 5 has two videos, so the placeholder there is updated and
// a second item inserted after it, with the rest of the week shifted down to
// keep the video sitting between the readings and the reflection.
//
// Existing items are updated in place rather than replaced, so item ids — and
// any submissions attached to them — survive.
//
// Usage (from apps/web):
//   node scripts/set-bible-project-videos.js --dry-run
//   node scripts/set-bible-project-videos.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SCHOOL_YEAR = '2026-2027'
const TITLE = 'Bible Project Video'

// Confirmed with Ben 2026-09-08. Descriptions match the weeks 1-2 convention:
// the passage the video covers, not the week's reading.
const VIDEOS = {
  3: [{ url: 'https://bibleproject.com/videos/genesis-12-50/', description: 'Genesis 12-50' }],
  4: [{ url: 'https://bibleproject.com/videos/john-1-12/', description: 'John 1-12' }],
  5: [
    { url: 'https://bibleproject.com/videos/exodus-1-18/', description: 'Exodus 1-18' },
    { url: 'https://bibleproject.com/videos/john-13-21/', description: 'John 13-21' },
  ],
  6: [{ url: 'https://bibleproject.com/videos/exodus-19-40/', description: 'Exodus 19-40' }],
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
    .from('weeks').select('id, week_number').eq('school_year_id', year.id).order('week_number')

  console.log(`${year.name}${dryRun ? '  (DRY RUN — no writes)' : ''}\n`)
  let updated = 0, inserted = 0, same = 0

  for (const weekNumber of Object.keys(VIDEOS).map(Number).sort((a, b) => a - b)) {
    const week = (weeks ?? []).find(w => w.week_number === weekNumber)
    if (!week) { console.error(`Week ${weekNumber}: not in ${year.name} — skipped`); continue }

    const { data: items } = await admin
      .from('homework_items')
      .select('id, type, title, description, external_url, sort_order')
      .eq('week_id', week.id).order('sort_order')

    const existing = (items ?? []).filter(i => i.type === 'video')
    const desired = VIDEOS[weekNumber]

    const matches = existing.length === desired.length && desired.every((d, i) =>
      existing[i].title === TITLE &&
      existing[i].external_url === d.url &&
      existing[i].description === d.description)
    if (matches) { console.log(`Week ${weekNumber}: already up to date`); same++; continue }

    if (existing.length > desired.length) {
      console.error(`Week ${weekNumber}: ${existing.length} video items but only ${desired.length} wanted — needs a manual look, skipped`)
      continue
    }

    // Update the placeholders that are already there.
    for (let i = 0; i < existing.length; i++) {
      const d = desired[i]
      console.log(`Week ${weekNumber}: updating "${existing[i].title}" -> ${d.description}  ${d.url}`)
      updated++
      if (dryRun) continue
      const { error } = await admin.from('homework_items')
        .update({ title: TITLE, description: d.description, external_url: d.url }).eq('id', existing[i].id)
      if (error) { console.error(`  UPDATE FAILED: ${error.message}`); process.exit(1) }
    }

    const extra = desired.slice(existing.length)
    if (extra.length === 0) continue

    // Insert the additional videos directly after the last existing one, so the
    // video block stays between the readings and the reflection. Everything at
    // or after that slot shifts down, applied high-to-low so two items never
    // hold the same sort_order mid-flight.
    const insertAt = existing.length > 0
      ? existing[existing.length - 1].sort_order + 1
      : Math.max(...(items ?? []).map(i => i.sort_order ?? 0)) + 1

    const toShift = (items ?? [])
      .filter(i => (i.sort_order ?? 0) >= insertAt)
      .sort((a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0))

    for (const item of toShift) {
      console.log(`Week ${weekNumber}: shifting "${item.title}" ${item.sort_order} -> ${item.sort_order + extra.length}`)
      if (dryRun) continue
      const { error } = await admin.from('homework_items')
        .update({ sort_order: item.sort_order + extra.length }).eq('id', item.id)
      if (error) { console.error(`  SHIFT FAILED: ${error.message}`); process.exit(1) }
    }

    for (let i = 0; i < extra.length; i++) {
      const d = extra[i]
      console.log(`Week ${weekNumber}: adding ${d.description} at sort_order ${insertAt + i}  ${d.url}`)
      inserted++
      if (dryRun) continue
      const { error } = await admin.from('homework_items').insert({
        week_id: week.id,
        type: 'video',
        title: TITLE,
        description: d.description,
        content: null,
        external_url: d.url,
        sort_order: insertAt + i,
      })
      if (error) { console.error(`  INSERT FAILED: ${error.message}`); process.exit(1) }
    }
  }

  console.log(`\n${dryRun ? 'DRY RUN — ' : 'Done — '}${updated} updated, ${inserted} added, ${same} already correct.`)
}

main().catch(e => { console.error(e); process.exit(1) })
