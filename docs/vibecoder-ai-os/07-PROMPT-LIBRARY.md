# Prompt Library

## Universal implementation prompt

```text
Objective:
[Describe the outcome.]

Observable acceptance criteria:
- [...]
- [...]

Constraints:
- Start with git status --short.
- Preserve all existing user changes.
- Do not broaden scope.
- Do not add dependencies without evidence.
- [For shell-only external models: Do not use MCP or Node REPL.]

Discovery:
- Read applicable AGENTS.md files and current checkpoint.
- Map the relevant architecture and existing patterns.
- Inspect exact implementation and tests before editing.
- Prefer targeted searches and snippets.

Implementation:
- Implement the smallest complete solution.
- Reuse shared logic.
- Add or update regression tests.
- Keep mock/live behavior honest.

Verification:
- Run targeted checks first.
- Run broader checks required by affected boundaries.
- Inspect git diff --stat and relevant final diff.
- Do not claim a check passed unless executed.

Final response:
- Root change summary.
- Files changed.
- Commands/tests and results.
- Remaining limitations/manual checks.
- Exact next action.
```

## Repository discovery prompt

```text
Work read-only.

Start with git status --short. Use codebase-memory MCP only if this profile has passed an actual MCP compatibility test.

Map:
- entry points,
- navigation,
- state and persistence,
- backend boundaries,
- AI provider architecture,
- tests,
- PWA/mobile boundaries,
- affected data flows.

Use targeted evidence. Do not edit. Return acceptance criteria, relevant paths/symbols, risks, and a smallest-complete implementation plan.
```

## Independent reviewer prompt

```text
Work read-only. Review the current diff against the original objective and acceptance criteria.

Prioritize:
1. correctness,
2. security/privacy,
3. state and persistence,
4. async/error behavior,
5. regression risk,
6. missing high-value tests,
7. accessibility/platform impact.

Lead with concrete findings. Cite paths and symbols. Separate confirmed defects from risks requiring verification. Avoid style-only feedback and do not edit.
```

## Release gate prompt

```text
Work read-only.

Review the objective, acceptance criteria, current diff, test evidence, release checklist, and known limitations.

Resolve disagreements using repository evidence. Report:
- blockers,
- important non-blockers,
- checks still required,
- automated vs browser vs physical-device evidence,
- one verdict: READY, READY_WITH_DOCUMENTED_LIMITATIONS, or NOT_READY.

Do not implement fixes.
```

## Sol decision prompt

```text
Use your depth only on the unresolved decision.

Confirmed facts:
[...]

Competing options:
[...]

Constraints:
[...]

Evaluate trade-offs, failure modes, reversibility, product impact, security, and long-term maintenance. Recommend one decision, state confidence, and identify what evidence would change the recommendation.
```

## External-model compatibility contract

```text
Do not use MCP tools or Node REPL. Use targeted shell commands and direct file inspection.

Never print or read secrets. Do not inspect .env files. Preserve user changes. Make no destructive Git operations. Stop and report if a required tool is unavailable instead of inventing results.
```
