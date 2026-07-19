import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootPath = fileURLToPath(new URL('../dist/', import.meta.url))
const forbidden = [/SUPABASE_SERVICE_ROLE_KEY/i, /VITE_SUPABASE_SERVICE_ROLE_KEY/i, /OPENAI_API_KEY/i, /BASIC_AI_API_KEY/i, /FEEDBACK_TO_EMAIL/i, /FEEDBACK_EMAIL_API_KEY/i, /sk-[A-Za-z0-9_-]{20,}/]
const files = []
function walk(directory) {
  if (!existsSync(directory)) return
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) walk(path)
    else files.push(path)
  }
}
walk(rootPath)
const leaks = []
for (const file of files) {
  const contents = readFileSync(file, 'utf8')
  if (forbidden.some(pattern => pattern.test(contents))) leaks.push(file.replace(rootPath, 'dist'))
}
if (leaks.length) {
  console.error(`FRONTEND_SECRET_SCAN_FAILED: ${leaks.join(', ')}`)
  process.exit(1)
}
console.log(`FRONTEND_SECRET_SCAN_OK files=${files.length}`)
