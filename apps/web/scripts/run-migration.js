// Runs a .sql migration against the linked Supabase project.
//
// DDL can't go through PostgREST/supabase-js, so this shells out to the
// Supabase CLI's Management API path. The access token is read from
// .env.local (gitignored) and passed via the child process environment, so it
// never appears in a shell command or in terminal output.
//
// Setup, once: create a personal access token at
//   https://supabase.com/dashboard/account/tokens
// then add to apps/web/.env.local:
//   SUPABASE_ACCESS_TOKEN=sbp_...
//
// Usage (from apps/web):
//   node scripts/run-migration.js supabase/migration-bible-plan.sql

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

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

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/run-migration.js <file.sql>')
  process.exit(1)
}

const sqlPath = path.resolve(file)
if (!fs.existsSync(sqlPath)) {
  console.error(`No such file: ${sqlPath}`)
  process.exit(1)
}

const env = loadEnvLocal()
const token = env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error(
    'SUPABASE_ACCESS_TOKEN is not set in apps/web/.env.local.\n\n' +
    'Create one at https://supabase.com/dashboard/account/tokens and add:\n' +
    '  SUPABASE_ACCESS_TOKEN=sbp_...\n'
  )
  process.exit(1)
}

console.log(`Running ${path.basename(sqlPath)} against the linked project…\n`)

const result = spawnSync(
  'supabase',
  ['db', 'query', '--linked', '-f', sqlPath, '--workdir', path.join(__dirname, '..')],
  { stdio: 'inherit', env: { ...process.env, SUPABASE_ACCESS_TOKEN: token } }
)

process.exit(result.status ?? 1)
