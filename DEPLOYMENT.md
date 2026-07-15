# SideShift deployment runbook

## Chosen architecture

Use one Render Web Service for the private beta. The service runs the existing Node server and serves the built Vite app from `dist`; `/api/*` stays on the same origin. Supabase is the managed persistence/auth layer. This is the least disruptive option because it preserves the existing server boundary, avoids cross-origin session configuration, and gives one HTTPS origin for the PWA and challenge links.

Render settings:

```text
Build command: npm ci && npm run build
Start command: npm start
Health check path: /api/health
Host: 0.0.0.0
```

Render supplies `PORT`; do not hard-code it in the service. Set `APP_BASE_URL` to the final Render HTTPS origin and `ALLOWED_ORIGINS` to that exact origin. Do not use `*` in private beta.

## Environment separation

Local development uses `.env` and may use `DATA_BACKEND=local`, `MOCK_AI=true`, and `DATA_DIR=.data`. Automated tests use `.env.test` or an explicit process environment. Private beta uses `.env.private-beta` as a template only and must use `DATA_BACKEND=supabase`, `VITE_DATA_BACKEND=supabase`, HTTPS URLs, and an explicit origin allowlist. Never commit a populated env file.

Required private-beta variables:

```text
APP_ENV=private-beta
APP_BASE_URL=https://<render-service>.onrender.com
ALLOWED_ORIGINS=https://<render-service>.onrender.com
DATA_BACKEND=supabase
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AI_PROVIDER=mock
MOCK_AI=true
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=https://<render-service>.onrender.com
VITE_APP_BASE_URL=https://<render-service>.onrender.com
VITE_APP_ENV=private-beta
```

The service-role key and any AI provider key are server-only. `npm run validate:env -- --production` and the production Vite build reject unsafe combinations.

## First deployment

1. Enable Supabase Anonymous Auth.
2. Apply migrations `0001` through `0005` with `npx supabase db push --yes` and verify with `npx supabase migration list`.
3. Set the Render variables above, deploy, and open `/api/health`.
4. Run `npm run test:production-smoke` with `DEPLOYED_FRONTEND_URL` and optional `DEPLOYED_API_URL` set to public HTTPS URLs.
5. Complete the device checklist in [PRIVATE_BETA_DEVICE_TEST.md](PRIVATE_BETA_DEVICE_TEST.md) before inviting beta users.

The expected health response includes `status: "ok"`, `environment: "private-beta"`, `backend: "supabase"`, `persistence: "supabase"`, and the configured AI mode. It never returns credentials or raw user data.

## Operations

Logs are structured JSON with request IDs, endpoint paths, safe error categories, and provider names. They do not include transcript or report text. Render redeploys are the rollback mechanism: redeploy the last known-good commit, then rerun the smoke command. To pause the beta, disable public access at the platform level and keep the service running only for operator verification; do not switch production to local persistence.

The current rate limits are process-local for the Node API and user-scoped in Supabase RPCs. Keep the beta on one service instance until shared rate limiting is introduced.

## Current deployment status

This workspace contains the deployment-ready implementation and runbook. No Render service or public URL was supplied to Codex, so a real deployment and public smoke test are not claimed.
