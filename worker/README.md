# SideShift AI Worker

This Worker is the hosted production API gateway for **SideShift AI**. It validates the
Supabase access token at `/auth/v1/user`, derives the authenticated user ID,
uses the existing AI quota RPCs through a narrowly scoped service-role
binding, and routes inference through a provider-agnostic layer.

## Architecture

```
Client (web/Android) → Worker → provider router
                              ├─ primary: Groq (openai/gpt-oss-120b)
                              └─ fallback: Cloudflare Workers AI (@cf/qwen/qwen3-30b-a3b-fp8)
```

Reliability features: bounded retry (1 per provider), exponential jitter, circuit breaker, idempotent quota RPCs, structured evaluation validation.

## Environment variables (names only)

| Name | Purpose |
|------|---------|
| `AI_PRIMARY_PROVIDER` | `groq` (default) |
| `AI_PRIMARY_MODEL` | `openai/gpt-oss-120b` |
| `AI_FALLBACK_PROVIDER` | `cloudflare` |
| `AI_FALLBACK_MODEL` | `@cf/qwen/qwen3-30b-a3b-fp8` |
| `GROQ_API_KEY` | Secret — primary provider |
| `GEMINI_API_KEY` | Secret — optional benchmark only |
| `OPENROUTER_API_KEY` | Secret — optional, not production default |
| `SUPABASE_URL` | Secret |
| `SUPABASE_ANON_KEY` | Secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret — quota RPCs only |
| `ALLOWED_ORIGINS` | CORS allowlist |
| `BASIC_AI_*` | Quota and token limits (legacy names retained) |

## Local development

Create `worker/.dev.vars` locally (never commit it):

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GROQ_API_KEY=...
ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,https://localhost
```

Run `npm run api:worker:dev`. The local Node API remains available through
`npm run api` for compatibility testing.

## Deploy

1. Run `npx wrangler login` once on the deployment machine.
2. Set production secrets (names only, never in files or chat):
   - `npx wrangler secret put GROQ_API_KEY --env production`
   - `npx wrangler secret put SUPABASE_URL --env production`
   - `npx wrangler secret put SUPABASE_ANON_KEY --env production`
   - `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production`
3. Set the production web origin in `worker/wrangler.jsonc` `ALLOWED_ORIGINS` and deploy:
   `npm run api:worker:deploy`
4. Set `VITE_API_BASE_URL` to the resulting HTTPS Worker URL for production web and Android builds.
5. Run `npm run api:worker:verify -- https://your-worker.example.workers.dev`

## Rollback

Redeploy the previous Worker version and set `AI_PRIMARY_PROVIDER=cloudflare` if Groq must be disabled. Quota RPCs and API routes are unchanged.

## Benchmark

`npm run benchmark:ai` — mock harness summary (no credentials).
`node scripts/benchmark-ai-providers.mjs --worker <url> --token <bearer>` — live Worker smoke.

## Cost estimate

Assumptions: 3 turns + 1 evaluation per debate; ~1.2k input + ~500 output tokens total via Groq primary.

Estimated **$0.006–$0.012 USD per completed debate** at current Groq OSS pricing tiers. Fallback Workers AI reduces cost when used but may increase latency.

The service-role key is used only by the Worker for privileged quota RPCs. It is never bundled in the frontend or APK.
