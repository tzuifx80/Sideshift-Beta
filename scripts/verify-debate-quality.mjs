#!/usr/bin/env node
/**
 * Debate quality harness — runs deterministic unit suites and records a summary artifact.
 * Live hosted-provider output requires operator credentials and separate manual review.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(root, 'docs', 'benchmarks')

const suites = [
  'src/lib/debateLanguage/debateLanguage.test.ts',
  'src/lib/debateQuality/debateQuality.test.ts',
  'src/lib/debateEngine/router.test.ts',
  'src/reliableCore/tests/reliableCore.test.ts',
  'src/lib/ai/ai.test.ts',
  'src/lib/debateRecovery.test.ts',
]

function runVitest(pattern) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test', '--', '--run', pattern], {
    cwd: root,
    stdio: 'pipe',
    shell: process.platform === 'win32',
    encoding: 'utf8',
  })
  return { ok: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}`.slice(-4000) }
}

function main() {
  mkdirSync(outputDir, { recursive: true })
  const results = suites.map(pattern => ({ pattern, ...runVitest(pattern) }))
  const vitestOk = results.every(item => item.ok)
  const report = {
    generatedAt: new Date().toISOString(),
    label: 'deterministic-and-mocked-contract',
    vitestOk,
    suites: results.map(({ pattern, ok }) => ({ pattern, ok })),
    coverage: {
      reliableCoreDeterministic: true,
      hostedPromptContractMocked: true,
      liveHostedProviderOutput: false,
      manualHumanMultilingualReview: 'required-before-production-claim',
    },
    notes: [
      'Reliable Core scenarios are deterministic and do not prove live hosted multilingual quality.',
      'Hosted provider live output requires operator credentials and manual human review.',
      'Mocked prompt-contract checks are covered by src/lib/ai/ai.test.ts.',
    ],
  }
  const path = join(outputDir, `debate-quality-${Date.now()}.json`)
  writeFileSync(path, JSON.stringify(report, null, 2))
  console.log(`Wrote ${path}`)
  if (!vitestOk) {
    for (const item of results.filter(entry => !entry.ok)) {
      console.error(`FAILED ${item.pattern}\n${item.output}`)
    }
    process.exit(1)
  }
}

main()
