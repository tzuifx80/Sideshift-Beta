# Windows Setup Guide

## Phase 1 — Freeze the working baseline

Do not remove the current working profile or gateway.

Record:

```powershell
codex --version
py -V:3.13 --version
Get-ChildItem "$env:USERPROFILE\.codex"
Get-ChildItem "$env:USERPROFILE\.codex\free-model-gateway"
```

Back up:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$env:USERPROFILE\.codex-backup-$stamp"
Copy-Item "$env:USERPROFILE\.codex" $backup -Recurse
Write-Host "Backup: $backup"
```

Never copy or print secret values into logs.

## Phase 2 — Revoke exposed credentials

Any key that appeared in a chat is compromised.

Create fresh keys and save them as Windows user variables through hidden prompts. Do not paste keys as standalone PowerShell commands.

## Phase 3 — Keep two separate stacks

### Native stack

Uses your Codex account:

```powershell
codex -m gpt-5.6-sol
codex -m gpt-5.6-terra
codex -m gpt-5.6-luna
```

Create named profiles only after verifying the models are available on your account.

### External stack

Uses LiteLLM on:

```text
http://127.0.0.1:4000/v1
```

The LiteLLM window must remain open.

## Phase 4 — Native profiles

Example `sol-high.config.toml`:

```toml
model = "gpt-5.6-sol"
model_reasoning_effort = "high"
model_reasoning_summary = "auto"

[features]
apps = false
fast_mode = false
```

Create equivalent Terra and Luna profiles using the desired effort.

Suggested initial set:

- `sol-high`
- `terra-medium`
- `terra-high`
- `luna-low`
- `luna-medium`

Avoid creating every combination before you need it.

## Phase 5 — External profile pattern

```toml
model = "YOUR_LITELLM_ALIAS"
model_provider = "free_gateway"
model_catalog_json = "C:/Users/Admin/.codex/free-model-gateway/external-models.json"
model_supports_reasoning_summaries = false
tool_output_token_limit = 12000

[model_providers.free_gateway]
name = "Local LiteLLM Gateway"
base_url = "http://127.0.0.1:4000/v1"
env_key = "LITELLM_MASTER_KEY"
wire_api = "responses"
request_max_retries = 1
stream_max_retries = 1
stream_idle_timeout_ms = 300000

[features]
apps = false
fast_mode = false
```

Use a model catalog with verified metadata to avoid Codex fallback metadata. Do not copy context sizes blindly.

## Phase 6 — MCP compatibility

Codex can disable an MCP server without deleting it.

For shell-only external routes:

```powershell
codex --profile glm52-code `
  -c mcp_servers.codebase-memory-mcp.enabled=false `
  -c mcp_servers.node_repl.enabled=false
```

For MCP candidates, test before normal use:

```powershell
codex exec --profile gemini35-tools `
  --sandbox read-only `
  -C "C:\Users\Admin\Documents\Debate" `
  "Call codebase-memory-mcp.get_architecture once. Then reply exactly MCP_OK. Do not edit files."
```

A successful text call does not prove MCP compatibility.

## Phase 7 — Project instruction stack

Copy and customize:

- `templates/global-AGENTS.md` to `C:\Users\Admin\.codex\AGENTS.md`
- `templates/project-root-AGENTS.md` to the repository root
- nested templates to their corresponding directories
- checkpoint and release-checklist templates into `docs/`

Codex merges AGENTS guidance from global to project to nested directories. Keep the relevant chain comfortably below the default 32 KiB limit.

## Phase 8 — Project config

Use `templates/project-config.toml` as a starting point.

Recommended:

```toml
[agents]
max_threads = 3
max_depth = 1
```

Three threads are enough for one main agent plus two read-only reviewers. More threads usually increase cost and noise for a solo developer.

## Phase 9 — Custom agents and skills

Copy the `.codex/agents/` and `.agents/skills/` templates into the repository.

Do not launch all reviewers for every task. Trigger them only when the task boundary warrants them.

## Phase 10 — Usage state

Inside native Codex:

```text
/usage daily
/usage weekly
```

Then run:

```powershell
.\router\update-usage.ps1
```

The router uses the lower percentage.

## Phase 11 — Router dry run

```powershell
.\router\recommend-model.ps1 `
  -Task "Audit Supabase RLS and challenge ownership" `
  -Mode Balanced
```

It prints the recommended profile and command. It launches only when `-Launch` is added.

## Phase 12 — Acceptance test

Before trusting the system, complete:

- native Sol/Terra/Luna launch,
- gateway health,
- external text test,
- external shell test,
- Gemini MCP test if intended,
- repository canary,
- one disposable edit test,
- one independent review,
- checkpoint update,
- final diff inspection.

Only then mark the route ACTIVE in `router/model-registry.json`.
