# Global Codex Working Agreements

## Safety

- Begin meaningful repository work with `git status --short`.
- Preserve all existing user changes.
- Never run destructive Git commands or overwrite unrelated work.
- Never read, print, commit, or expose secrets.
- Treat external-provider context as leaving the local machine.

## Evidence

- Separate confirmed facts from hypotheses.
- Confirm commands and architecture against repository evidence.
- Do not claim tests passed unless they were executed successfully.
- Use focused log excerpts instead of complete noisy logs.

## Workflow

1. Define observable acceptance criteria.
2. Inspect applicable repository instructions and current checkpoint.
3. Map impact before editing.
4. Implement the smallest complete solution.
5. Add or update regression tests.
6. Run targeted checks, then required broader checks.
7. Inspect `git diff --stat` and relevant diff sections.
8. Report results, failures, limitations, and exact next action.

## Efficiency

- Prefer targeted searches and snippets.
- Do not repeatedly read unchanged files.
- Do not use subagents for small tasks.
- Use subagents mainly for independent read-only exploration or review.
- Keep one implementation owner.
- Update the checkpoint before compaction or handoff.

## Product quality

- Keep mock/live and human/simulated behavior honest.
- Preserve user state through refresh, retry, and navigation.
- Include loading, empty, unavailable, offline, and error states.
- Respect accessibility, responsiveness, security, and privacy.
