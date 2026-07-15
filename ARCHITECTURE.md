# SideShift architecture

## Runtime path

```text
React/Vite PWA
  -> AuthProvider (anonymous Supabase Auth)
  -> AppRepository
  -> SupabaseRepository
  -> Supabase Postgres/RLS/RPC

React -> same-origin Node /api boundary -> mock or configured AI provider
```

Local development uses the same repository interface with browser persistence and mock AI. Production rejects local persistence. The intended private-beta deployment is one Render Web Service serving the built app and API on one HTTPS origin.

## Authentication and data

`AuthProvider` restores or creates an anonymous session, bootstraps profile/preferences, and exposes retry/reset operations. `App` hydrates private state before rendering the main shell. Active snapshots are stored in the debate row and normalized turns/stances support refresh recovery.

## AI, analytics, and safety

The browser calls only `/api/ai/opponent` and `/api/ai/judge`; the server validates inputs/outputs and keeps provider credentials private. The UI clearly labels mock mode. Analytics sends only an allow-listed event plus small scalar properties and never raw debate text. The API emits request IDs and safe structured categories, adds production security headers/CORS, and rate-limits process-local legacy API routes.

## PWA and sharing

The manifest, SVG icons, service worker, offline fallback, update handling, install prompt, and network-loss UI are part of the built app. The worker caches only public app-shell/static assets and bypasses API/challenge/Supabase data. Challenge links use the configured HTTPS app base URL. Shift Cards can be natively shared as PNG files or downloaded.

## Deletion and moderation

Reports go through a validated authenticated RPC. “Delete my beta data” is owner-authenticated and preserves another creator’s challenge result while anonymizing the responder reference. Legal pages are static routes at `/privacy`, `/terms`, and `/community`.
