// Owns which week each Bible Project video and book reading belongs to.
//
// Replaces set-bible-project-videos.js, which hardcoded weeks 3-6 and would
// have overwritten the wrong week's video once the schedule moved. This script
// declares the whole Part One schedule instead, so re-running it converges on
// the table below rather than applying a relative shift twice.
//
// The videos and the Father Heart of God reading were originally loaded a week
// ahead of the readings they accompany — week 3's reading was Job while its
// video was Genesis 12-50 — so everything moved one week later on 2026-09-08.
//
// Items are matched by URL (videos) and title (book readings) and moved, so
// item ids and any submissions travel with them. sort_order is then renumbered
// per week into the canonical order: readings, videos, reflection, book.
//
// Usage (from apps/web):
//   node scripts/set-weekly-media.js --dry-run
//   node scripts/set-weekly-media.js

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SCHOOL_YEAR = '2026-2027'
const PART_ONE_WEEKS = 18
const VIDEO_TITLE = 'Bible Project Video'

// Descriptions are the passage the video covers, not the week's reading.
const VIDEOS = {
  2: [{ url: 'https://bibleproject.com/videos/genesis-1-11/', description: 'Genesis 1-11' }],
  3: [{ url: 'https://bibleproject.com/videos/job/', description: 'Book of Job' }],
  4: [{ url: 'https://bibleproject.com/videos/genesis-12-50/', description: 'Genesis 12-50' }],
  5: [{ url: 'https://bibleproject.com/videos/john-1-12/', description: 'John 1-12' }],
  6: [
    { url: 'https://bibleproject.com/videos/exodus-1-18/', description: 'Exodus 1-18' },
    { url: 'https://bibleproject.com/videos/john-13-21/', description: 'John 13-21' },
  ],
  7: [{ url: 'https://bibleproject.com/videos/exodus-19-40/', description: 'Exodus 19-40' }],
}

// Book readings are matched by title and only moved — their chapter/page detail
// is authored in the admin panel and is not restated here.
const BOOK_READINGS = {
  2: ['The Father Heart of God'],
}

// Where each type sits within a week. Mirrors how week 1 was authored.
const TYPE_ORDER = ['bible_reading', 'video', 'reflection', 'book_reading']

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

  const { data: allWeeks } = await admin
    .from('weeks').select('id, week_number').eq('school_year_id', year.id).order('week_number')
  const weeks = (allWeeks ?? []).filter(w => w.week_number <= PART_ONE_WEEKS)
  const weekByNumber = new Map(weeks.map(w => [w.week_number, w]))
  const numberByWeekId = new Map(weeks.map(w => [w.id, w.week_number]))

  const { data: items } = await admin
    .from('homework_items')
    .select('id, week_id, type, title, description, content, external_url, sort_order, show_attribution')
    .in('week_id', weeks.map(w => w.id))

  console.log(`${year.name}${dryRun ? '  (DRY RUN — no writes)' : ''}\n`)

  const moves = []
  const touchedWeeks = new Set()

  // --- videos: matched by URL ---
  const videoItems = (items ?? []).filter(i => i.type === 'video')
  const seenUrls = new Set()
  for (const [weekNumber, wanted] of Object.entries(VIDEOS)) {
    for (const want of wanted) {
      seenUrls.add(want.url)
      const target = weekByNumber.get(Number(weekNumber))
      const existing = videoItems.filter(i => i.external_url === want.url)
      if (existing.length > 1) {
        console.error(`  ${want.url}: ${existing.length} copies — needs a manual look, skipped`)
        continue
      }
      if (existing.length === 0) {
        console.error(`  ${want.url}: not in the database — skipped (add it via the admin panel)`)
        continue
      }
      const item = existing[0]
      const from = numberByWeekId.get(item.week_id)
      if (from === Number(weekNumber) && item.description === want.description && item.title === VIDEO_TITLE) continue
      moves.push({ item, toWeek: target, label: `video ${want.description}`, from, description: want.description, title: VIDEO_TITLE })
      touchedWeeks.add(from); touchedWeeks.add(Number(weekNumber))
    }
  }
  for (const stray of videoItems.filter(i => !seenUrls.has(i.external_url))) {
    console.error(`  week ${numberByWeekId.get(stray.week_id)}: video "${stray.description ?? stray.title}" (${stray.external_url}) is not in the schedule — left alone`)
  }

  // --- book readings: matched by title, moved only ---
  const bookItems = (items ?? []).filter(i => i.type === 'book_reading')
  const seenTitles = new Set()
  for (const [weekNumber, titles] of Object.entries(BOOK_READINGS)) {
    for (const title of titles) {
      seenTitles.add(title)
      const target = weekByNumber.get(Number(weekNumber))
      const existing = bookItems.filter(i => i.title === title)
      if (existing.length !== 1) {
        console.error(`  "${title}": ${existing.length} matching item(s) — needs a manual look, skipped`)
        continue
      }
      const item = existing[0]
      const from = numberByWeekId.get(item.week_id)
      if (from === Number(weekNumber)) continue
      moves.push({ item, toWeek: target, label: `book "${title}"`, from })
      touchedWeeks.add(from); touchedWeeks.add(Number(weekNumber))
    }
  }
  for (const stray of bookItems.filter(i => !seenTitles.has(i.title))) {
    console.error(`  week ${numberByWeekId.get(stray.week_id)}: book "${stray.title}" is not in the schedule — left alone`)
  }

  if (moves.length === 0) {
    console.log('Nothing to move — already matches the schedule.')
  }

  const movedIds = new Set(moves.map(m => m.item.id))
  const { count } = movedIds.size
    ? await admin.from('submissions').select('*', { count: 'exact', head: true }).in('homework_item_id', [...movedIds])
    : { count: 0 }
  if (count) console.log(`(${count} submission(s) on moved items — they travel with the item)\n`)

  for (const m of moves) {
    console.log(`week ${m.from} -> ${numberByWeekId.get(m.toWeek.id)}: ${m.label}`)
    if (dryRun) continue
    const patch = { week_id: m.toWeek.id }
    if (m.description !== undefined) patch.description = m.description
    if (m.title !== undefined) patch.title = m.title
    const { error } = await admin.from('homework_items').update(patch).eq('id', m.item.id)
    if (error) { console.error(`  MOVE FAILED: ${error.message}`); process.exit(1) }
  }

  // --- renumber sort_order in the weeks that changed ---
  if (!dryRun && touchedWeeks.size) {
    for (const weekNumber of [...touchedWeeks].sort((a, b) => a - b)) {
      const week = weekByNumber.get(weekNumber)
      if (!week) continue
      const { data: current } = await admin
        .from('homework_items').select('id, type, sort_order').eq('week_id', week.id).order('sort_order')
      const ordered = (current ?? []).slice().sort((a, b) => {
        const ta = TYPE_ORDER.indexOf(a.type), tb = TYPE_ORDER.indexOf(b.type)
        return (ta === -1 ? 99 : ta) - (tb === -1 ? 99 : tb) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
      })
      // Two passes, out of the way and back down, so no two rows ever collide.
      for (let i = 0; i < ordered.length; i++) {
        await admin.from('homework_items').update({ sort_order: 1000 + i }).eq('id', ordered[i].id)
      }
      for (let i = 0; i < ordered.length; i++) {
        await admin.from('homework_items').update({ sort_order: i }).eq('id', ordered[i].id)
      }
      console.log(`week ${weekNumber}: renumbered ${ordered.length} item(s)`)
    }
  }

  console.log(`\n${dryRun ? 'DRY RUN — ' : 'Done — '}${moves.length} item(s) moved.`)
}

main().catch(e => { console.error(e); process.exit(1) })
