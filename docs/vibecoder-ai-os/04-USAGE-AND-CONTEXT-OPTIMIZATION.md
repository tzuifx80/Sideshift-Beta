# Usage and Context Optimization

## 1. Spend intelligence at decision points

The most expensive model should not perform every mechanical step.

High-leverage native usage:

- resolve ambiguous requirements,
- choose architecture,
- assess security,
- integrate cross-cutting changes,
- review a difficult diff,
- declare release readiness.

Low-leverage native usage:

- list files,
- read repetitive boilerplate,
- rerun known commands,
- format text,
- summarize huge logs,
- perform deterministic renames.

## 2. Weekly allocation model

A useful starting budget:

- 45% implementation and integration,
- 20% critical debugging,
- 15% release/security review,
- 10% architecture and product decisions,
- 10% emergency reserve.

External/free usage handles most:

- repository discovery,
- documentation,
- initial test-gap scans,
- repetitive verification,
- low-risk implementation,
- independent opinions.

## 3. Session budget

### Small task

- one model,
- one short session,
- no subagents,
- stop after targeted verification.

### Standard task

- one implementation session,
- one optional read-only review,
- checkpoint at completion.

### Large task

- discovery session,
- implementation session,
- review session,
- release gate if warranted.

Do not keep one conversation alive for unrelated tasks merely to avoid starting a new session.

## 4. Context hygiene

### Before context becomes noisy

Update `docs/CODEX_CHECKPOINT.md` with:

- objective,
- acceptance criteria,
- confirmed facts,
- decisions,
- files changed,
- commands run,
- results,
- unresolved failures,
- remaining work,
- exact next action.

Then use `/compact` or start a new session.

### Prevent context pollution

- send focused error excerpts,
- store architecture in docs,
- store status in docs,
- use read-only subagents for noisy exploration,
- use targeted searches,
- do not paste generated files back into chat,
- link paths and symbols instead.

## 5. Prompt compression

Replace repeated prose with durable rules in AGENTS.md and skills.

A task prompt should usually fit this structure:

```text
Objective:
Acceptance criteria:
Constraints:
Discovery:
Verification:
Final response:
```

Do not repeat repository-wide rules already loaded from AGENTS.md.

## 6. Reasoning ladder

1. Minimal/low for classification, extraction, and deterministic edits.
2. Medium for normal implementation.
3. High for root-cause debugging, state, auth, RLS, architecture.
4. XHigh for rare critical ambiguity.
5. Ultra only for highly parallel work where multiple subagents materially improve quality.

## 7. Subagent cost control

Official Codex behavior allows subagents, but each subagent consumes its own tokens and tools.

Use:

- maximum 2 read-only subagents for most tasks,
- maximum 3 for release/security,
- depth 1,
- one write owner.

Do not spawn agents merely to “get more opinions.” Give each one a distinct falsifiable responsibility.

## 8. Review-model optimization

Codex supports a separate `review_model`.

Use a different model family when practical:

- implementation: Terra/GLM,
- review: DeepSeek/Sol,
- release gate: Sol/Terra native.

A reviewer should focus on findings, not rewrite the implementation.

## 9. Model health cache

Record:

- last text success,
- last shell success,
- last MCP success,
- average latency,
- quota/auth failure,
- truncation behavior,
- hallucination incidents,
- destructive behavior,
- last real repository canary.

Automatically prefer recent healthy routes.

## 10. Stop conditions

Stop a model and switch when:

- it repeats the same failed tool call,
- it invents files or commands,
- it ignores explicit scope twice,
- it fails auth or provider availability,
- it cannot produce usable output due reasoning-token consumption,
- it tries to use incompatible MCP tools,
- it proposes destructive changes without evidence.

Do not keep retrying an unsuitable model because it has a high benchmark score.
