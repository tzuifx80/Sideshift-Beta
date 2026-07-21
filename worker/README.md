# SideShift Basic Worker

This Worker is the hosted production API for SideShift Basic. It validates the
Supabase access token at `/auth/v1/user`, derives the authenticated user ID,
uses the existing Basic AI quota RPCs through a narrowly scoped service-role
binding, and calls the Workers AI binding directly.

## Local development

Create `worker/.dev.vars` locally (never commit it):

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,https://localhost
```

Run `npm run api:worker:dev`. The local Node API remains available through
`npm run api` for compatibility testing.

## Deploy

1. Run `npx wrangler login` once on the deployment machine.
2. Set the production secrets without putting them in files or chat:
   `npx wrangler secret put SUPABASE_URL --env production`,
   `npx wrangler secret put SUPABASE_ANON_KEY --env production`, and
   `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production`.
3. Set the production web origin in `worker/wrangler.jsonc` and deploy with
   `npm run api:worker:deploy`.
4. Set `VITE_API_BASE_URL` to the resulting HTTPS Worker URL for production
   web and Android builds.
5. Run `npm run api:worker:verify -- https://your-worker.example.workers.dev`.

The service-role key is used only by the Worker for the existing privileged
quota RPCs. It is never bundled in the frontend or APK.
