// Parses a "Journey Through the Bible" reading-plan PDF into structured weeks.
//
// Per week the PDF gives five numbered survey readings (the Shorter plan, #1
// being the New Testament reading) and an "ENTIRE BIBLE PLAN" line (the Whole
// Bible plan).
//
// Structure comes from the text layer (pdftotext -layout) rather than the link
// annotations, because the source is inconsistent: week 14's day 5 has no
// hyperlink at all, and week 15 has only four days. Anchor-order parsing
// silently mis-assigns days when that happens.
//
// BibleGateway URLs are generated from the reference text instead of scraped.
// The PDF's own links are just ?search=<the reference text>&version=NLT, so
// generating reproduces them and works for unlinked readings too.
//
// Outputs to stdout only — nothing is written to the database here.
//
// Usage (from apps/web):
//   node scripts/parse-reading-plan.js "/path/to/plan.pdf"
//   node scripts/parse-reading-plan.js "/path/to/plan.pdf" --json > weeks.json

const { execFileSync } = require('child_process')

const WORD_NUMBERS = [
  'ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN',
  'NINETEEN', 'TWENTY',
]

// Used to tell a wrapped reading line apart from surrounding prose.
const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  'Samuel', 'Kings', 'Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms',
  'Proverbs', 'Ecclesiastes', 'Song', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
  'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  'Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', 'Thessalonians',
  'Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', 'Peter', 'Jude', 'Revelation',
]

const VERSION = 'NIV'

function biblegatewayUrl(reference) {
  const q = new URLSearchParams({ search: reference, version: VERSION })
  return `https://www.biblegateway.com/passage/?${q.toString()}`
}

/** Strips the labels that sometimes sit inside the reading text. */
function cleanReference(text) {
  return text
    .replace(/^\s*(?:\d+\.)?\s*/, '')
    .replace(/^NEW\s+TESTAMENT\s*:\s*/i, '')
    .replace(/^(?:ENTIRE\s+BIBLE\s+)?PLAN\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A wrapped continuation of a reading, rather than a line of era prose. */
function looksLikeContinuation(line) {
  const t = line.trim()
  if (!t) return false
  if (/^\d+\./.test(t)) return false
  if (/^(WEEK|ENTIRE)/i.test(t)) return false
  if (/^\(/.test(t)) return false // "(See days 3-5 in the next era section…)"
  if (/^\d/.test(t)) return true // bare verse continuation, e.g. "8:29-35"
  const first = t.split(/[\s,;:]/)[0]
  return BOOKS.includes(first)
}

function parse(pdfPath) {
  const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })

  const lines = text.split('\n')
  const weeks = []
  let current = null
  let open = null // the day currently accepting continuation lines

  const flush = () => { open = null }

  for (const raw of lines) {
    const line = raw.replace(/ /g, ' ').trimEnd()

    const header = line.match(/^\s*WEEK\s+([A-Za-z]+)\s*(?::|\(continued\))/i)
    if (header) {
      const n = WORD_NUMBERS.indexOf(header[1].toUpperCase())
      if (n > 0) {
        const existing = weeks.find(w => w.week === n)
        current = existing || { week: n, days: [], whole: null }
        if (!existing) weeks.push(current)
        flush()
        continue
      }
    }

    if (!current) continue

    const wholeMatch = line.match(/ENTIRE\s+BIBLE\s+PLAN\s*:\s*(.*)$/i)
    if (wholeMatch) {
      current.whole = cleanReference(wholeMatch[1])
      open = { get text() { return current.whole }, append: s => { current.whole += ' ' + s } }
      continue
    }

    const numbered = line.match(/^\s*([1-6])\.\s+(.*)$/)
    if (numbered) {
      const n = Number(numbered[1])
      const body = numbered[2].trim()
      if (/ENTIRE\s+BIBLE\s+PLAN/i.test(body)) { flush(); continue } // handled above
      if (n >= 1 && n <= 5) {
        const day = { day: n, reference: cleanReference(body) }
        current.days.push(day)
        open = { append: s => { day.reference = `${day.reference} ${s}`.replace(/\s+/g, ' ').trim() } }
      }
      continue
    }

    if (open && looksLikeContinuation(line)) {
      open.append(line.trim())
      continue
    }

    if (line.trim() === '') flush()
  }

  return weeks.sort((a, b) => a.week - b.week).map(w => ({
    week: w.week,
    shorter: w.days
      .sort((a, b) => a.day - b.day)
      .map(d => ({ day: d.day, reference: d.reference, url: biblegatewayUrl(d.reference) })),
    whole: w.whole ? { reference: w.whole, url: biblegatewayUrl(w.whole) } : null,
    dayCount: w.days.length,
    ok: w.days.length === 5 && !!w.whole,
  }))
}

/**
 * Splits a day's references into one line per reference, carrying the book
 * name forward. The source abbreviates after the first mention — "Genesis
 * 4:1-16, 25-26; 5:1; 6:9-22" — so a naive split leaves bare "5:1" fragments
 * that mean nothing on their own line.
 */
function splitReferences(reference) {
  const parts = reference.split(';').map(s => s.trim()).filter(Boolean)
  const out = []
  let lastBook = null

  for (const part of parts) {
    // "2 Samuel 6:1-11" — a numbered book, not a verse continuation
    const bookMatch = part.match(/^((?:[123]\s+)?[A-Z][a-z]+)\b/)
    if (bookMatch) {
      lastBook = bookMatch[1]
      out.push(part)
      continue
    }
    // "5:1" or "6:9-22" — continuation of the previous book
    if (lastBook && /^\d+\s*[:\-–]/.test(part)) {
      out.push(`${lastBook} ${part}`)
      continue
    }
    out.push(part)
  }
  return out
}

function main() {
  const pdfPath = process.argv[2]
  if (!pdfPath) {
    console.error('Usage: node scripts/parse-reading-plan.js <plan.pdf> [--json]')
    process.exit(1)
  }

  const weeks = parse(pdfPath)

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(weeks, null, 2) + '\n')
    return
  }

  const bad = weeks.filter(w => !w.ok)
  console.log(`Parsed ${weeks.length} week(s); ${weeks.length - bad.length} complete (5 days + whole plan).\n`)

  for (const w of weeks) {
    console.log(`WEEK ${w.week}${w.ok ? '' : `   ⚠ ${w.dayCount} day(s)${w.whole ? '' : ', no whole-plan line'}`}`)
    for (const d of w.shorter) console.log(`  Day ${d.day}: ${d.reference}`)
    console.log(`  WHOLE : ${w.whole ? w.whole.reference : '— missing —'}`)
    console.log('')
  }

  if (bad.length) console.log(`⚠ Needs a manual look: week(s) ${bad.map(w => w.week).join(', ')}`)
}

module.exports = { parse, splitReferences, biblegatewayUrl, VERSION }

if (require.main === module) main()
