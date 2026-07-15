# Model Fleet and Routing

## 1. Native OpenAI fleet

OpenAI’s current Codex guidance describes:

- **Sol:** complex, ambiguous, high-value work needing judgment and polish.
- **Terra:** everyday workhorse with strong reasoning and tool use.
- **Luna:** clear, repeatable, high-volume tasks.

Recommended profiles:

| Profile | Reasoning | Role |
|---|---:|---|
| `sol-medium` | medium | difficult bounded work |
| `sol-high` | high | security, architecture, ambiguous implementation |
| `sol-xhigh` | xhigh | rare critical final gate |
| `terra-low` | low | routine native tool scans |
| `terra-medium` | medium | default native implementation |
| `terra-high` | high | MCP-heavy or broad repository work |
| `luna-low` | low | tiny clear tasks |
| `luna-medium` | medium | efficient native fallback |
| `luna-high` | high | hard but well-defined work while preserving Sol |

Do not use Ultra by default. Subagents multiply token use.

## 2. Zero-new-key external fleet

These candidates fit the NVIDIA NIM and Gemini keys you already configured. Exact provider availability and model IDs must be retested.

### Elite active pool

| Alias | Primary role | Why it belongs |
|---|---|---|
| `gemini35-tools` | large context, multimodal, possible MCP | best external discovery candidate |
| `glm52-code` | complex implementation | strongest free coding candidate in your table |
| `minimaxm3-fullstack` | mobile/full-stack/multimodal | strong platform and UI route |
| `deepseekv4-review` | debugging/security/review | ideal independent critic |
| `nemotron3-ultra` | planning/second opinion | long-context reasoning reserve |
| `deepseekv4flash-fast` | quick debugging/fixes | fast high-volume route |
| `kimi26-creative` | product/game/UX ideation | creative specialist |
| `gemini31-router` | classification/summaries/tiny edits | usage-efficient router |

### Reserve pool

| Candidate | Role |
|---|---|
| Gemini 2.5 Pro | difficult Google fallback |
| Gemini 2.5 Flash | price-performance/high-volume fallback |
| Gemini 2.5 Flash-Lite | cheapest classification/summary route |
| Qwen 3.5 397B A17B | multilingual/coding second opinion |
| Qwen 3.5 122B A10B | faster multilingual route |
| Step 3.7 Flash | vision/agentic overflow |
| Step 3.5 Flash | efficient agentic overflow |
| MiniMax M2.7 | fast text-only overflow |
| Nemotron 3 Super | coding/reasoning reserve |
| Nemotron Nano Omni | multimodal fast overflow |
| GPT OSS 120B | open reasoning reserve |
| Mistral Medium 3.5 | general coding/writing reserve |
| Mistral Large 3 | large-model reserve |
| Gemma 4 31B/26B | multimodal reserve |
| Qwen3 Next 80B | efficient general overflow |

A candidate stays in reserve until it passes the required tests.

## 3. Optional provider expansion

### OpenRouter

One key gives access to a changing free pool. Use it for:

- outages,
- exhausted direct quotas,
- low-risk experiments,
- independent second opinions.

Do not use the random free router as the main implementer for a large change. The underlying selected model can vary.

### GitHub Models

Useful as an occasional low-volume backup, especially when GitHub authentication is already available. Daily limits may be low, so do not make it the main workflow.

### Groq or Cerebras

Useful for very fast open-model responses and cheap review/triage. Add only after the core stack is stable.

### Other free providers

OVHcloud, SambaNova, Cloudflare, ModelScope, Kilo Code, and similar providers can increase resilience, but each key and compatibility layer adds maintenance. Add a provider only when it solves a specific shortage:

- speed,
- modality,
- outage resilience,
- or independent model-family review.

## 4. Compatibility classes

### Class N — Native

- strongest Codex tool compatibility,
- MCP allowed,
- suitable for sensitive repository work,
- usage is limited and valuable.

### Class M — MCP-tested external

- text endpoint passed,
- Codex shell passed,
- actual MCP call passed,
- repository canary passed.

Only this class can receive automatic MCP-heavy work.

### Class S — Shell-only external

- text endpoint passed,
- Codex shell passed,
- MCP disabled,
- uses targeted shell and direct file inspection.

Most NVIDIA models belong here unless future tests prove more.

### Class T — Text-only

- direct response works,
- Codex tools not verified.

Use for brainstorming, plan review, summaries, and independent critique—not autonomous repository changes.

### Class X — Disabled

- failed health, auth, context, output, or tool tests.

Keep it configured only for later retesting.

## 5. Required test ladder

### Test A — Authentication/text

The model must answer a tiny Responses request.

### Test B — Output quality

It must follow an exact short instruction without truncating all useful output into hidden reasoning.

### Test C — Codex shell

It must execute a read-only shell task and return the expected marker.

### Test D — Apply/edit behavior

In a disposable repository, it must make one trivial controlled edit, show the diff, and not touch unrelated files.

### Test E — MCP

Only candidates intended for MCP must call one actual MCP tool successfully.

### Test F — Repository canary

It must inspect package scripts and report exact commands without invention.

### Test G — Reliability

Repeat the canary several times or after provider changes. One lucky success is not enough for a critical route.

## 6. Routing score

For each candidate, calculate conceptually:

```text
total =
  task_fit
+ tool_compatibility
+ recent_health
+ context_fit
+ modality_fit
+ quality
+ speed_when_relevant
- usage_pressure
- quota_risk
- privacy_risk
- observed_failure_penalty
```

Hard blockers override score:

- MCP required but MCP test failed,
- model unavailable,
- API auth failed,
- sensitive task on an unapproved external provider,
- context requirement exceeds verified limit,
- prior destructive behavior.

## 7. Task-to-model matrix

| Task | First choice | Second choice | Independent review |
|---|---|---|---|
| tiny clear task | Luna Low / Gemini router | DeepSeek Flash | usually none |
| everyday feature | Terra Medium | GLM | DeepSeek Pro |
| complex free feature | GLM | MiniMax/Nemotron | DeepSeek Pro |
| repository architecture | Terra High | MCP-tested Gemini | Sol Medium |
| security/RLS | Sol High | Terra High | DeepSeek + final Sol gate |
| root-cause debugging | DeepSeek Pro | Terra/GLM | Sol Medium |
| Android/Capacitor | MiniMax M3 | Terra/Gemini | DeepSeek |
| UI screenshot analysis | Gemini/MiniMax | Step | Terra |
| creative ideation | Kimi | Gemini/Nemotron | Sol only for final strategic choice |
| release verification | Terra High | Sol High | security/test subagents |
| documentation | Gemini router/Luna | Terra | reviewer if high-impact |
| huge read-only analysis | Gemini/Nemotron | Terra | Sol synthesis |

## 8. Usage-aware policy

Use the lower remaining percentage from `/usage daily` and `/usage weekly`.

| Remaining | Native policy |
|---:|---|
| 75–100% | Sol for high-risk ambiguity; Terra default; Luna small tasks |
| 50–74% | Terra default; Sol only critical; external planning/review |
| 25–49% | external implementation by default; Terra/Luna for tool reliability |
| 0–24% | free-first; preserve Sol/Terra; Luna only when native required |

Maintain a 15–20% reserve for deadlines, releases, or failures.

## 9. Stage-based maximum intelligence

### Discovery

Prefer Terra High or MCP-tested Gemini. Use Sol only when the problem itself is unclear.

### Implementation

One owner: Terra, GLM, MiniMax, or Sol depending on risk.

### Review

Different family: DeepSeek, Nemotron, or Sol read-only.

### Release gate

Native model, read-only. Do not ask it to rewrite everything; ask for blockers, evidence, and verdict.

## 10. External-provider restrictions

- Disable incompatible MCP servers by default.
- Do not include secrets.
- Do not let a fallback silently change product behavior.
- Do not claim a model supports 1M context solely because a table says so—verify current provider metadata.
- Do not set reasoning parameters that the provider rejects.
- Do not treat benchmark scores as proof of tool reliability.
- Do not route security-sensitive code externally without deliberate approval.
