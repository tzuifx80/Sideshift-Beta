# SideShift

SideShift is a mobile-first perspective game: defend the side you disagree with, reflect on what moved, and challenge a friend through a private link.

## Run locally

```powershell
npm ci
Copy-Item .env.example .env
npm run dev:all
```

Open `http://127.0.0.1:5173`. Local mode uses browser persistence and mock AI. It is development-only.

## Backend modes

Local/test use `VITE_DATA_BACKEND=local`, `DATA_BACKEND=local`, and `MOCK_AI=true`. Private beta and production use `VITE_DATA_BACKEND=supabase` and `DATA_BACKEND=supabase` with anonymous Supabase Auth. The browser receives only the Supabase anon key. Service-role and AI provider keys stay server-side.

Environment templates:

- `.env.example` — local defaults and variable reference.
- `.env.test.example` — isolated test configuration.
- `.env.private-beta.example` — HTTPS/Supabase/Render template; fill values in the platform, never commit secrets.

## Supabase private beta

Enable Anonymous Auth, then apply and verify all migrations:

```powershell
npx supabase db push --yes
npx supabase migration list
npm run test:supabase
npm run test:rls
```

`0011_team_debate_and_groups.sql` adds persisted Team Debate sessions plus private Groups, members, invite hashes, group-only topics, and server-checked constructive participation points. It preserves the existing migration history; apply all migrations in order.

## Verification

```powershell
npm run validate:env
npm run typecheck
npm run lint
npm test
npm run build
npm run test:pwa
npm run audit:frontend-secrets
npm audit --omit=dev
npm run test:playwright:supabase
```

`npm run test:production-smoke` requires `DEPLOYED_FRONTEND_URL` and optional `DEPLOYED_API_URL`; it intentionally refuses localhost and reports a clear blocked status when no public deployment exists.

## Android groundwork

The web/PWA build remains the source of truth. On Windows, install Android Studio and an Android SDK/device first, then run:

```powershell
npm ci
npm run cap:sync
npm run cap:open
```

The equivalent Android beta commands are:

```powershell
npm run android:sync
npm run android:open
npm run android:build
```

`android:build` produces a debug APK when the Android SDK is installed and `ANDROID_HOME` or `android/local.properties` points to it. Team Debate is text-first; Voice input is enabled only when the browser/WebView exposes speech recognition, and raw audio is not stored.

The Capacitor app id is `com.sideshift.app`. Puter sign-in continues to be user-triggered; native lifecycle, back, deep-link, share, and external-browser adapters are included, but no store or device release is claimed here.

Android development API routing is explicit. Browser development leaves `VITE_API_BASE_URL` empty and uses the Vite proxy. Android emulator builds set `VITE_ANDROID_API_TARGET=emulator` and use `http://10.0.2.2:8787`. Physical-device builds set `VITE_ANDROID_API_TARGET=device` and an ignored local `VITE_API_BASE_URL=http://<PC_LAN_IP>:8787`, while the API server uses `HOST=0.0.0.0` and an explicit development `ALLOWED_ORIGINS=https://localhost`. Never commit the LAN address. Production builds require `VITE_API_BASE_URL=https://...`; they do not use localhost, private-LAN fallbacks, or cleartext traffic.

After changing these values, rebuild and sync the native bundle:

```powershell
npm run build
npx cap sync android
```

The managed browser regression is lifecycle-safe:

```powershell
python scripts/supabase_challenge_flow.py
```

It starts isolated API/frontend processes, waits for readiness, saves logs/traces on failure, and kills the complete process tree in `finally`.

## Product safety surfaces

The app includes a safe `/api/health`, explicit mock-AI disclosure, no-raw-text analytics events, structured redacted server logs, HTTPS/CORS checks, PWA manifest/service worker/offline fallback, production security headers, challenge deep links, share-card PNG export, and `/privacy`, `/terms`, and `/community` pages. Profile/account controls expose “Delete my beta data”.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Render single-service plan and [PRIVATE_BETA_DEVICE_TEST.md](PRIVATE_BETA_DEVICE_TEST.md) for the physical-device release gate.
