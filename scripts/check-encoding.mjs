import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = process.cwd()
const scanRoots = ['src', 'scripts', 'server.mjs', 'index.html', 'public', 'supabase/migrations']
const ignoredAppliedMigrations = new Set(['0011_team_debate_and_groups.sql', '0012_collaboration_security_and_deletion.sql', 'check-encoding.mjs'])
const mojibake = [
  /\u00c3[\u0080-\u00bf]/u,
  /\u00c2[\u0080-\u00bf]/u,
  /\u00e2[\u0080-\u00bf][\u0080-\u00bf]/u,
  /\uFFFD/u,
]

async function collect(path) {
  const absolute = join(root, path)
  const info = await stat(absolute)
  if (!info.isDirectory()) return [absolute]
  const entries = await readdir(absolute, { withFileTypes: true })
  return (await Promise.all(entries.filter(entry => !['__pycache__', '.pytest_cache', 'node_modules'].includes(entry.name)).map(entry => collect(join(path, entry.name))))).flat()
}

const files = (await Promise.all(scanRoots.map(collect))).flat()
const failures = []
for (const file of files) {
  if (ignoredAppliedMigrations.has(file.split(/[\\/]/u).pop())) continue
  const text = await readFile(file, 'utf8')
  if (mojibake.some(pattern => pattern.test(text))) failures.push(relative(root, file))
}
if (failures.length) {
  console.error('Mojibake detected in active files:\n' + failures.join('\n'))
  process.exit(1)
}
console.log('Encoding guard passed for ' + (files.length - ignoredAppliedMigrations.size) + ' active files.')
