# The Complete VibeCoder AI Operating System

## 1. What “maximized” actually means

A maximized vibe-coding setup is not measured by how many model names appear in a configuration file. It is measured by:

- how often the correct model is chosen,
- how little context is wasted rediscovering the repository,
- how rarely tools fail,
- how consistently changes are tested,
- how well expensive native usage is preserved,
- how quickly failures are diagnosed,
- how clearly unfinished work is handed to the next session,
- and whether the final product is honest, secure, accessible, and maintainable.

The system has six layers:

1. **Model fleet:** native and external models with defined roles.
2. **Compatibility layer:** LiteLLM, profile metadata, health tests, and MCP restrictions.
3. **Context layer:** AGENTS.md, architecture docs, status docs, release checklist, and checkpoint.
4. **Execution layer:** feature, debugging, UI, database, mobile, and release workflows.
5. **Quality layer:** tests, independent review, browser verification, and final gate.
6. **Usage layer:** routing based on risk, task shape, model health, and remaining allowance.

## 2. Recommended vibe-coder stack

### Core coding environment

- Windows PC
- Git and GitHub
- VS Code or your preferred editor
- Codex CLI
- PowerShell
- Node.js and the package manager already used by the repository
- Existing project framework—do not rewrite a working stack just to follow trends

### For your Debate-style application

Keep the proven shape unless repository evidence supports a change:

- React and TypeScript
- Vite
- Supabase with migrations, RPCs, and RLS
- Vitest for unit/component tests
- Playwright for browser and two-context flows
- PWA/service worker
- Capacitor for Android
- semantic design tokens and responsive layouts
- local and live AI-provider boundaries
- explicit mock/live labels

### AI and repository intelligence

- Native Codex tools for the most reliable shell and MCP execution
- LiteLLM as a local gateway for external providers
- codebase-memory MCP for graph-first discovery—but only on profiles proven compatible
- browser tooling for real UI behavior
- Git diff and test evidence as the source of truth

## 3. The golden workflow

Every meaningful change follows this sequence:

1. Run `git status --short`.
2. Preserve all existing user changes.
3. Restate observable acceptance criteria.
4. Identify the relevant architecture boundary.
5. Use graph-first discovery when compatible.
6. Inspect exact files and symbols before editing.
7. Reproduce the issue or define a failing test where practical.
8. Implement the smallest complete solution.
9. Add or update regression tests.
10. Run targeted verification.
11. Run broader checks required by affected boundaries.
12. Inspect `git diff --stat`.
13. Inspect the relevant final diff.
14. Run an independent review for meaningful or risky work.
15. Update the checkpoint and current-status documents.
16. Report confirmed results, failures, manual checks, and limitations separately.

Never skip understanding and jump directly to editing because a model sounds confident.

## 4. Four levels of task execution

### Level 1 — Quick

For typos, narrow text changes, one small test, or an obvious isolated fix.

- one low-cost model,
- no subagents,
- targeted test,
- final diff inspection.

### Level 2 — Standard

For a normal feature or bug fix across a few files.

- one implementation model,
- repository instructions loaded,
- targeted tests,
- broader lint/type/build as appropriate,
- optional independent review.

### Level 3 — High assurance

For auth, persistence, AI-provider behavior, Supabase, PWA, mobile, or multi-file state changes.

- read-only discovery,
- implementation,
- regression tests,
- independent review from another model family,
- browser or integration verification,
- explicit remaining limitations.

### Level 4 — Release/critical

For production release, security, RLS, migrations, data loss, or architecture changes.

- native or verified MCP discovery,
- highest-fit implementation model,
- dedicated security/test reviewers,
- complete required automated checks,
- real browser or two-user testing,
- physical-device checks when Android is affected,
- Sol/Terra final gate,
- one of: READY, READY_WITH_DOCUMENTED_LIMITATIONS, NOT_READY.

## 5. Context is an asset

Repeated discovery is one of the largest wastes in AI coding.

Maintain:

- root `AGENTS.md`,
- nested `AGENTS.md` files for specialized boundaries,
- `docs/ARCHITECTURE.md`,
- `docs/CURRENT_STATUS.md`,
- `docs/RELEASE_CHECKLIST.md`,
- `docs/CODEX_CHECKPOINT.md`.

Use the repository files as memory—not a giant chat history.

### Context discipline

- Do not paste full build logs into the main thread.
- Show only the relevant 20–40 lines around failures.
- Do not repeatedly read unchanged files.
- Prefer symbols and targeted snippets to whole-file reads.
- Move exploration and review to read-only subagents when it is genuinely independent.
- Update the checkpoint before `/compact`, ending a long session, or changing model/thread.
- Start a new session when context is mostly old investigation rather than current decisions.

## 6. Prompt architecture

A strong task prompt contains:

### Objective

What must change and why.

### Observable acceptance criteria

What the user can see or what tests must prove.

### Scope

Files, flows, platforms, or systems that may be affected.

### Constraints

What must remain unchanged, what tools are forbidden, and what compatibility rules apply.

### Discovery requirements

How to inspect the repository before editing.

### Verification requirements

Exact levels of testing and manual checks expected.

### Final response contract

What evidence the model must report.

Do not use long motivational role descriptions. Spend tokens on constraints, evidence, and definition of done.

## 7. Multi-model intelligence without chaos

Use different models by **stage**, not five models editing the same files.

Recommended maximum workflow:

1. **Explorer:** maps architecture and risks; read-only.
2. **Implementer:** owns the code change.
3. **Reviewer:** independently inspects the diff; read-only.
4. **Release gate:** resolves remaining risk and declares readiness; read-only.

Parallel work is best for:

- independent codebase exploration,
- security review,
- test-gap review,
- documentation verification,
- independent reproduction attempts.

Parallel work is dangerous for:

- multiple agents editing the same files,
- database migrations,
- shared state refactors,
- dependency upgrades,
- release configuration.

## 8. Model reasoning policy

Reasoning is a resource.

- Use low/minimal for classification, extraction, renames, formatting, and summaries.
- Use medium for ordinary implementation.
- Use high for architecture, debugging, security, state, migrations, and integration.
- Use xhigh only for rare high-stakes ambiguity and final judgment.
- Use Ultra only when independent parallel subagents materially improve the result.

High reasoning on a badly scoped task wastes more tokens than medium reasoning on a precise task.

## 9. Git strategy

### Before changes

- inspect `git status --short`,
- identify user changes,
- never reset or overwrite unrelated work,
- create a branch for meaningful features,
- use a worktree only for genuinely independent parallel work.

### During changes

- keep commits logically coherent,
- avoid mixing refactors with features,
- do not mass-format unrelated files,
- inspect changed-file count before continuing.

### Before completion

- `git diff --stat`,
- relevant `git diff -- <paths>`,
- secret scan,
- generated-file review,
- status check,
- no false claim that tests passed.

## 10. Testing ladder

Use the cheapest relevant check first:

1. targeted unit test,
2. affected test file,
3. related suite,
4. type-check,
5. lint,
6. production build,
7. integration/database checks,
8. browser/E2E,
9. PWA behavior,
10. Android/native checks,
11. physical device.

A build passing does not prove a user flow works. A policy existing does not prove RLS is secure. A mocked AI test does not prove live-provider behavior.

## 11. UI quality rules

A vibe-coded UI must not merely “look modern.”

Require:

- correct hierarchy,
- stable spacing scale,
- semantic tokens,
- responsive layouts,
- visible keyboard focus,
- real loading, empty, offline, unavailable, and error states,
- reduced-motion behavior where appropriate,
- readable contrast,
- no fake users, fake matchmaking, fake AI providers, or fake live results,
- honest labels for mock/live behavior,
- no destructive action without confirmation or undo where appropriate.

Verify on multiple viewport sizes and with actual interactions—not only screenshots.

## 12. Database and backend rules

- Never rewrite applied migrations.
- Create new ordered migrations.
- Treat RLS as default deny.
- Test behavior as the actual authenticated users—not only through privileged access.
- Never expose service-role secrets to the client.
- Verify ownership and challenge access across two users/two browser contexts.
- Review RPC security, search path, auth assumptions, and input validation.
- Preserve schema compatibility or include an explicit migration path.
- Separate client trust from server-enforced guarantees.

## 13. AI feature rules

- Keep provider-specific code behind a provider abstraction.
- Label mock and live behavior honestly.
- Preserve selected takes, drafts, debate state, and recovery behavior.
- Support cancellation, timeout, retry, and visible failure states.
- Validate structured outputs.
- Bound repair attempts.
- Minimize personal data sent to providers.
- Never simulate a human opponent and present it as real.
- Test provider resolution and fallback behavior independently.
- Do not let a fallback silently change product semantics.

## 14. Mobile and PWA rules

- Keep web behavior as the source when practical.
- Change Capacitor source configuration instead of generated output.
- Verify lifecycle pause/resume, back behavior, deep links, external browser, sharing, and persistence.
- Distinguish automated checks from emulator and physical-device checks.
- Never claim Android is verified when only the web build passed.
- Verify PWA install/update/reconnect behavior separately.

## 15. Security and privacy

### Never send externally

- `.env` content,
- API keys,
- Supabase service role,
- private user messages,
- real personal data,
- credentials,
- private certificates,
- production database dumps.

### External-model rule

Before using an external model on a repository, assume the content sent to it leaves the local machine. Use native models for sensitive code or redact the task.

### Secret handling

- environment variables only,
- no keys in scripts or YAML,
- revoke exposed keys immediately,
- scan Git history if a secret may have been committed,
- do not paste working keys into troubleshooting chats.

## 16. Definition of done

A task is complete only when:

- acceptance criteria are satisfied,
- changed behavior has tests where practical,
- required checks were actually run,
- final diff is understood,
- no unrelated user work was overwritten,
- security/privacy boundaries remain intact,
- manual checks are listed honestly,
- known limitations are documented,
- the exact next action is clear if anything remains.

## 17. Daily operating rhythm

### Start

1. Choose the smallest valuable outcome.
2. Check `/usage daily` and `/usage weekly` when native usage matters.
3. Pick Quick, Standard, High Assurance, or Release mode.
4. Launch the appropriate model/profile.
5. Load or update the checkpoint.

### During

- keep one implementation owner,
- use read-only reviewers,
- stop scope expansion,
- update acceptance criteria when requirements change,
- checkpoint before long context growth.

### End

- run final checks,
- inspect diff,
- update status/checkpoint,
- commit or leave a clear exact next action,
- record which model worked well or failed.

## 18. The best default for a solo vibe coder

For most meaningful work:

1. Terra or a verified Gemini route explores when MCP is needed.
2. GLM or Terra implements.
3. DeepSeek independently reviews.
4. Sol gates only high-risk or release-critical work.
5. Luna and fast Gemini handle routine tasks.
6. MiniMax owns mobile/full-stack tasks.
7. Kimi owns ideation—not final technical approval.
