@AGENTS.md

# SOT-LMS Mobile — School of Transformation companion app

## What this is
The Expo/React Native companion to the web app (`apps/web`) — same Supabase backend, homework-tracking only. Students check this week's homework, watch videos, submit reflections, and review past weeks. See `apps/web/CLAUDE.md` for the full product context (roles, database schema, admissions/billing) — this file covers what's mobile-specific.

**By design, this app has no billing/tuition flow and no application flow** — students pay and apply from the web portal only. This also sidesteps Apple's In-App Purchase requirement for tuition payments; adding an in-app "Pay tuition" button later would need that revisited.

## Tech stack
- **Framework**: Expo SDK 54, Expo Router, React Native 0.81
- **Database + Auth**: Supabase (`@supabase/supabase-js`), same project as web
- **Language**: TypeScript

## Project structure
```
app/
  _layout.tsx            # Root layout
  login.tsx              # Login screen (background image + card, matches web styling)
  (tabs)/
    _layout.tsx
    index.tsx             # This Week — homework checklist with announcements
    open.tsx              # Open assignments across weeks
    history.tsx            # Past weeks with completion state
  item/[itemId].tsx        # Homework item detail (video/reading/reflection)
  week/[weekId].tsx        # Week detail
  account.tsx              # Account settings (incl. theme toggle)
components/
  ThemeProvider.tsx         # Resolves light/dark/system, provides useTheme()
lib/
  supabase.ts               # Supabase client (AsyncStorage session persistence)
  theme.ts                  # ThemeColors tokens + LIGHT/DARK palettes
  openAssignments.ts
assets/                     # Icons, splash, login-bg.jpg
```

## Theming (dark mode)
`lib/theme.ts` defines a `ThemeColors` type (~30 semantic tokens: background, surface, borders, text variants, accent, danger/success/warning/info) with two concrete palettes, `LIGHT` and `DARK`. `ThemeProvider` persists a `ThemePref` (`'light' | 'dark' | 'system'`) under AsyncStorage key `sot-theme`, resolves against the OS scheme when set to `'system'`, and exposes `{ colors, scheme, pref, setPref }` via `useTheme()`. Every screen's `StyleSheet` reads from `colors` rather than hardcoded hex values. Dark values mirror the web app's inversion logic: page background darkest, cards one step lighter, and the near-black "accent" (buttons, checkboxes, progress bar) flips to a light pill with dark text.

## Environment variables
No `.env` file is used directly — Expo reads `EXPO_PUBLIC_*` vars at build/start time.
```
EXPO_PUBLIC_SUPABASE_ANON_KEY=<see local env / EAS secrets>
```
The Supabase URL itself is hardcoded in `lib/supabase.ts` (not secret — it's a public project URL, same as web's `NEXT_PUBLIC_SUPABASE_URL`).

## Running locally
```bash
cd apps/mobile
npm start          # expo start — then open in Expo Go or a simulator
npm run ios        # expo start --ios
npm run android    # expo start --android
npm run web        # expo start --web
```

## EAS build profiles (`eas.json`)
- **`development`** — `developmentClient: true`, internal distribution, iOS `resourceClass: m-medium`
- **`preview`** — internal distribution
- **`production`** — `autoIncrement: true`
- `submit.production` — present but default/empty (not yet configured)

No CI/automation publishes builds — merging to `main` only updates source. Shipping to a device requires running an EAS build yourself; there's no `expo-updates`/OTA config wired up yet, so even source-only changes (JS/styling) need a new build, not just a merge.

## What's built
Login, This Week (homework checklist + announcements), item detail (embedded YouTube/Vimeo player — fixed WebView embed errors 153/154, falls back to external link for non-embeddable URLs), History (past weeks), Account settings, dark mode (light/dark/system, per-device). Full status: see the "Mobile App (Expo)" section of `../../docs/plan.md`.

**Not yet started**: push notifications, app store submission (blocked on Apple Developer enrollment).

## Known inconsistency
`AGENTS.md` in this directory points to Expo's `v56.0.0` versioned docs, but `package.json` pins `expo: ~54.0.0`. Treat the installed SDK version (54) as ground truth when checking API behavior; the AGENTS.md docs link may be stale or aspirational.
