# School of Transformation LMS

Monorepo for the School of Transformation discipleship training school platform.

## Structure

```
apps/
  web/     → Next.js web app (student portal + admin panel)
  mobile/  → Expo React Native mobile app
```

## Running locally

```bash
# Web (Next.js) — http://localhost:3000
npm run web

# Mobile (Expo) — scan QR with Expo Go
npm run mobile
```

## Services
- **GitHub**: https://github.com/benarp/SOT-LMS
- **Supabase**: https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab
- **Vercel** (web hosting): root directory = `apps/web`

## Per-app docs
See `apps/web/CLAUDE.md` and `apps/mobile/CLAUDE.md` for app-specific documentation.
