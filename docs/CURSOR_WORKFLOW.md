# Cursor Workflow — SideShift

Guide for using Cursor Composer 2.5 efficiently on SideShift.

## Modes

| Mode | When to use |
|------|-------------|
| **Ask** | Understanding code, reviewing architecture, planning milestones, reading RLS — no edits needed. |
| **Agent** | Single focused implementation or bugfix with tool access. |
| **Composer 2.5 Standard** | Multi-file features, refactors across boundaries, v0.2 milestone work. Default for delivery. |
| **Fast** | Small, well-scoped edits (typo, single test, config tweak) where speed beats depth. |
| **Max Mode** | Large ambiguous investigations, security-sensitive cross-cutting changes, or when Standard stalls after two failed attempts. |

## Context efficiency

- Only `00-core.mdc` is always applied — keep requests focused so other rules attach via globs.
- Open relevant files (e.g. `worker/src/index.ts`) to auto-attach Worker rules.
- Do not paste entire checkpoints; point to `docs/CODEX_CHECKPOINT.md` or `docs/exec-plans/v0.2-private-beta.md`.
- Start a **new conversation** for verification after implementation (fresh context, smaller diff).

## Skills

Invoke by name in the prompt or let Composer auto-select from descriptions:

| Skill | Trigger |
|-------|---------|
| `feature-delivery` | New behaviour, user flow, milestone implementation |
| `bug-investigation` | Failures, regressions, flaky tests, session bugs |
| `security-review` | Auth, RLS, Worker, migrations, entitlements |
| `ui-qa` | Layout, a11y, i18n overflow, state handling |
| `release-gate` | Pre-release, APK handoff, deploy verification |

Example: *"Use the release-gate skill to verify v0.2 readiness."*

## Subagents

Use sparingly — two focused agents beat five redundant ones.

| Agent | When |
|-------|------|
| `explorer` | Broad codebase mapping before unfamiliar work |
| `implementer` | One approved vertical slice (main coding) |
| `verifier` | Post-implementation review in fresh context |
| `security-reviewer` | Security-sensitive boundary changes only |

**Do not** launch parallel agents on overlapping files.  
**Do not** use subagents for trivial one-file changes.

### Fresh verification conversation

1. Complete implementation in session A.
2. Open new Composer thread (session B).
3. Paste: acceptance criteria, changed files, and *"Use verifier subagent to review."*
4. Verifier runs diff review and targeted checks without implementation bias.

## Validation shortcut

For most changes:

```
targeted vitest → npm run typecheck → npm run lint
```

Before release, run the full sequence in `.cursor/skills/release-gate/SKILL.md`.

## Common commands

See `AGENTS.md` for the command table. Confirm against `package.json` before running.

## Avoid wasting usage

- State the milestone and acceptance criteria up front.
- Name the skill or subagent when the task matches.
- One subsystem per session when possible (Worker OR Android OR Supabase).
- Do not ask Composer to rediscover repo structure — reference `AGENTS.md`.
- Do not load `docs/vibecoder-ai-os/` into routine sessions (reference material only).

## Cursor version notes

- Custom subagents (`.cursor/agents/*.md`) may require Cursor nightly/beta channel.
- Known issue: IDE may strip YAML frontmatter when opening agent files on stable — edit externally if needed.
- Subagent `model: inherit` uses the parent Composer model.
