// Splits each week's "Entire Bible Plan" reading into chunks that BibleGateway
// will actually display in full, and verifies every chunk against the live site.
//
// BibleGateway caps how much scripture one request returns and then silently
// drops the remaining passages — so a whole week's reading rendered as one link
// shows only its opening chapters with no indication anything is missing. Week
// 1's link, for instance, requests "Genesis 1:1-11:26, Job 1, John 1-2" and
// renders only Genesis 1:1-10:15. Every one of the 18 weeks was affected.
//
// The cap is content-length based (Genesis tops out around 10 chapters), not a
// fixed chapter count, so chunks are checked against the real site and split
// further when they come back short. The verified result is written to
// whole-plan-chunks.json for load-reading-plan.js to consume, keeping the
// loader deterministic and offline.
//
// Usage (from apps/web):
//   node scripts/chunk-whole-plan.js "/path/to/plan.pdf" --no-verify   # structure only, offline
//   node scripts/chunk-whole-plan.js "/path/to/plan.pdf"
//   node scripts/chunk-whole-plan.js "/path/to/plan.pdf" --max-chapters 6

const fs = require('fs')
const path = require('path')
const { parse, biblegatewayUrl, VERSION } = require('./parse-reading-plan.js')
const { applyOverrides } = require('./plan-overrides.js')

const OUT = path.join(__dirname, 'whole-plan-chunks.json')

// Chapter counts, needed to expand a bare book name ("Ruth") into a range.
const BOOK_CHAPTERS = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34, Joshua: 24,
  Judges: 21, Ruth: 4, '1 Samuel': 31, '2 Samuel': 24, '1 Kings': 22, '2 Kings': 25,
  '1 Chronicles': 29, '2 Chronicles': 36, Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42,
  Psalm: 150, Psalms: 150, Proverbs: 31, Ecclesiastes: 12, 'Song of Solomon': 8,
  Isaiah: 66, Jeremiah: 52, Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14,
  Joel: 3, Amos: 9, Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3,
  Zephaniah: 3, Haggai: 2, Zechariah: 14, Malachi: 4, Matthew: 28, Mark: 16,
  Luke: 24, John: 21, Acts: 28, Romans: 16, '1 Corinthians': 16, '2 Corinthians': 13,
  Galatians: 6, Ephesians: 6, Philippians: 4, Colossians: 4, '1 Thessalonians': 5,
  '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1,
  Hebrews: 13, James: 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1,
  '3 John': 1, Jude: 1, Revelation: 22,
}

// BibleGateway echoes back its own canonical book name, which is not always the
// one the manual uses. Without this a correct chunk reads as a failed one and
// gets split forever.
const BOOK_ALIASES = {
  'song of solomon': 'song of songs',
  psalms: 'psalm',
}

const BOOK_RE = '(?:[123]\\s+)?[A-Za-z][A-Za-z ]*?'

/**
 * Splits a week's reference into the pieces the manual itself lists.
 *
 * Both separators are hard splits. The manual writes runs of chapter ranges
 * inside one book as bare numbers after a comma ("Psalm 4-6, 7-10, 12-26.
 * 28-41"), so a splitter that only broke before a capital letter left those as
 * a single unparseable blob and dropped them — Psalm 42-150 in week 17 alone.
 */
function segments(reference) {
  return reference
    .replace(/\.\s+(?=\d)/g, ', ') // "12-26. 28-41" — stray period in the source
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * Parses one segment into a range.
 *
 * Verse boundaries are carried through rather than rounded to whole chapters:
 * week 1 ends at Genesis 11:26 and week 4 picks up at 11:27, so widening
 * either to "Genesis 11" would assign 11:27-32 to both weeks.
 *
 * Returns null if unparseable, so the caller can flag it rather than guess.
 */
function parseSegment(seg, prev) {
  const lastBook = prev?.book ?? null
  let m

  // "Genesis 1:1-11:26" — verse range spanning chapters
  m = seg.match(new RegExp(`^(${BOOK_RE})\\s+(\\d+):(\\d+)\\s*[-–]\\s*(\\d+):(\\d+)$`))
  if (m) {
    return { book: m[1].trim(), from: +m[2], fromVerse: +m[3], to: +m[4], toVerse: +m[5] }
  }

  // "Genesis 12-36" — plain chapter range
  m = seg.match(new RegExp(`^(${BOOK_RE})\\s+(\\d+)\\s*[-–]\\s*(\\d+)$`))
  if (m) return { book: m[1].trim(), from: +m[2], to: +m[3] }

  // "Genesis 11:27-31" — verses within one chapter; kept verbatim, never split
  m = seg.match(new RegExp(`^(${BOOK_RE})\\s+(\\d+):[\\d,\\s-]+$`))
  if (m) return { book: m[1].trim(), from: +m[2], to: +m[2], verbatim: seg }

  // "Psalm 90" — a single chapter
  m = seg.match(new RegExp(`^(${BOOK_RE})\\s+(\\d+)$`))
  if (m) return { book: m[1].trim(), from: +m[2], to: +m[2] }

  // "Ruth" — a bare book name
  m = seg.match(/^((?:[123]\s+)?[A-Za-z][A-Za-z ]+)$/)
  if (m && BOOK_CHAPTERS[m[1].trim()]) {
    return { book: m[1].trim(), from: 1, to: BOOK_CHAPTERS[m[1].trim()] }
  }

  // Bare numbers continuing the previous book: "7-10" after "Psalm 4-6".
  // Refused when the previous segment carried verses, where a bare number is
  // more likely another verse range than a chapter.
  const bareOk = lastBook && !prev.verbatim && !prev.toVerse
  m = seg.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (m && bareOk) return { book: lastBook, from: +m[1], to: +m[2] }

  m = seg.match(/^(\d+)$/)
  if (m && bareOk) return { book: lastBook, from: +m[1], to: +m[1] }

  return null
}

// Single-chapter books (Philemon, Jude, Obadiah...) are cited by name alone:
// BibleGateway renders "Philemon 1" correctly but echoes it back as "Philemon",
// and the bare name is how the manual cites them anyway.
function label(book, from, to) {
  if (BOOK_CHAPTERS[book] === 1) return book
  return from === to ? `${book} ${from}` : `${book} ${from}-${to}`
}

/**
 * Breaks a range into pieces of at most maxChapters, preserving any verse
 * boundary on the trailing chapter.
 */
function splitRange(range, maxChapters) {
  if (range.verbatim) return [range.verbatim]

  const out = []
  // A closing verse boundary ends a partial chapter; chunk the full ones, then
  // append the partial so nothing spills past where the week actually stops.
  const lastFull = range.toVerse ? range.to - 1 : range.to
  const startsMidChapter = range.fromVerse && range.fromVerse > 1

  if (startsMidChapter) {
    // Not present in Part One; flagged rather than guessed at.
    return [{ unhandled: `${range.book} ${range.from}:${range.fromVerse}-${range.to}:${range.toVerse}` }]
  }

  for (let start = range.from; start <= lastFull; start += maxChapters) {
    out.push(label(range.book, start, Math.min(start + maxChapters - 1, lastFull)))
  }
  if (range.toVerse) out.push(`${range.book} ${range.to}:1-${range.toVerse}`)
  return out
}

const norm = s => {
  let t = ' ' + s.toLowerCase().trim() + ' '
  for (const [from, to] of Object.entries(BOOK_ALIASES)) t = t.split(from).join(to)
  return t.replace(/[^a-z0-9]/g, '')
}

async function renders(reference) {
  const res = await fetch(biblegatewayUrl(reference), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SOT-LMS reading plan check)' },
  })
  const body = await res.text()
  const shown = [...body.matchAll(/class="dropdown-display-text">([^<]*)/g)]
    .map(m => m[1]).filter(x => !/International|Version/i.test(x))
  return shown.length === 1 && norm(shown[0]) === norm(reference)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Checks one chunk, halving it and re-checking if it comes back short. */
async function verifyOrSplit(book, from, to, verbatim, depth = 0) {
  const ref = verbatim || label(book, from, to)
  const ok = await renders(ref)
  await sleep(400) // be a considerate client
  if (ok) return [{ reference: ref, url: biblegatewayUrl(ref), verified: true }]

  if (verbatim || from >= to || depth >= 4) {
    return [{ reference: ref, url: biblegatewayUrl(ref), verified: false }]
  }
  const mid = Math.floor((from + to) / 2)
  return [
    ...await verifyOrSplit(book, from, mid, null, depth + 1),
    ...await verifyOrSplit(book, mid + 1, to, null, depth + 1),
  ]
}

async function main() {
  const pdfPath = process.argv[2]
  const maxIdx = process.argv.indexOf('--max-chapters')
  const maxChapters = maxIdx > -1 ? Number(process.argv[maxIdx + 1]) : 6
  const noVerify = process.argv.includes('--no-verify')
  if (!pdfPath || pdfPath.startsWith('--')) {
    console.error('Usage: node scripts/chunk-whole-plan.js <plan.pdf> [--max-chapters 6] [--no-verify]')
    process.exit(1)
  }

  const weeks = applyOverrides(parse(pdfPath), (w, o) => {
    console.log(`  ↳ week ${w.week}: overriding Entire Bible Plan -> ${o.whole}`)
  })

  const result = {}
  const unparsed = []

  for (const w of weeks) {
    if (!w.whole) continue
    let prev = null
    const refs = []
    for (const seg of segments(w.whole.reference)) {
      const range = parseSegment(seg, prev)
      if (!range) { unparsed.push(`week ${w.week}: "${seg}"`); continue }
      prev = range
      for (const piece of splitRange(range, maxChapters)) {
        if (piece.unhandled) { unparsed.push(`week ${w.week}: "${piece.unhandled}" (starts mid-chapter)`); continue }
        refs.push({ book: range.book, text: piece, verbatim: range.verbatim ? piece : null })
      }
    }

    const chunks = []
    for (const r of refs) {
      if (noVerify) {
        chunks.push({ reference: r.text, url: biblegatewayUrl(r.text), verified: null })
        continue
      }
      const m = r.verbatim ? null : r.text.match(/^(.*?)\s+(\d+)(?:-(\d+))?$/)
      chunks.push(...(m
        ? await verifyOrSplit(m[1], +m[2], m[3] ? +m[3] : +m[2], null)
        : await verifyOrSplit(null, 0, 0, r.text)))
    }

    result[w.week] = chunks
    const bad = chunks.filter(c => c.verified === false).length
    console.log(`week ${String(w.week).padStart(2)}: ${chunks.length} chunk(s)${bad ? `  ⚠ ${bad} unverified` : ''}`)
    for (const c of chunks) {
      console.log(`    ${c.verified === null ? '·' : c.verified ? '✓' : '✗'} ${c.reference}`)
    }
  }

  const total = Object.values(result).flat()
  if (!noVerify) {
    fs.writeFileSync(OUT, JSON.stringify({ version: VERSION, maxChapters, weeks: result }, null, 2) + '\n')
    console.log(`\nWrote ${path.basename(OUT)} — ${total.length} chunk(s), ${total.filter(c => !c.verified).length} unverified.`)
  } else {
    console.log(`\n--no-verify: ${total.length} chunk(s) planned, nothing written, nothing checked.`)
  }

  if (unparsed.length) {
    console.log(`\n⚠ Segments that could not be parsed (left out):`)
    for (const u of unparsed) console.log(`   ${u}`)
    process.exitCode = 1
  }
}

module.exports = { segments, parseSegment, splitRange, label, norm }

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) })
