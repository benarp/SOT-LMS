// Editorial corrections applied on top of what the reading-plan PDF literally says.
//
// Kept as explicit overrides rather than folded into the parser so they stay
// visible, and so re-running against a corrected PDF is a no-op rather than
// silently re-applying a fix that's no longer needed.
//
// Shared by load-reading-plan.js and chunk-whole-plan.js: both must agree on
// what a week's reading is, or the chunked links would point at a different
// passage than the one the loader records.
//
// week 3 whole: the PDF reads "Job 18-42, John 3-4", repeating week 2's New
// Testament reading. Every other week's Entire Bible line matches that week's
// survey NT reading (17/18), and John 5-6 appears in no Entire Bible line at
// all — so a whole-Bible reader would read John 3-4 twice and skip John 5-6.
// Confirmed with Ben 2026-09-08; also flagged in docs/reading-plan-part-one.md
// for the next revision of the PDF.

const { biblegatewayUrl } = require('./parse-reading-plan.js')

const OVERRIDES = {
  3: { whole: 'Job 18-42, John 5-6' },
}

/** Applies OVERRIDES to parsed weeks. `log` is called for each change applied. */
function applyOverrides(weeks, log = () => {}) {
  return weeks.map(w => {
    const override = OVERRIDES[w.week]
    if (!override?.whole) return w
    if (w.whole && w.whole.reference === override.whole) return w // PDF already fixed
    log(w, override)
    return { ...w, whole: { reference: override.whole, url: biblegatewayUrl(override.whole) } }
  })
}

module.exports = { OVERRIDES, applyOverrides }
