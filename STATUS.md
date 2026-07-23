# Status

Completion: `READY_WITH_DOCUMENTED_LANGUAGE_LIMITATIONS`

## Multilingual debate behavior — 2026-07-24

- **Behavioral contract v3** (`debate-opponent-v3`): shared rules in `src/lib/debateContract/`, client `buildDebateContext`, Worker `prompts.ts` v3.
- **Debate language model**: explicit/Auto modes, lock on first substantive argument, persisted on `AiDebateData` + `DebateSnapshot.language`, restored on resume via `App.tsx` hydration.
- **Hosted language repair**: one bounded repair inside Worker `generate()` before quota completion (same `requestId`, no replay).
- **Quality validation**: deterministic checks in `src/lib/debateQuality/`; hosted failures fall back to Reliable Core for supported languages.
- **Reliable Core honesty**: offline completion for EN/DE/FR/ES/IT only; unsupported offline languages show recoverable UI state.
- **RTL**: `dir="auto"` on debate messages and composer.
- **Harness**: `npm run verify:debate-quality` (deterministic + mocked contract; live hosted review manual).
- **Verification**: 209 Vitest + 12 Worker tests, typecheck, lint, secret scan, production build green in this pass.
- Live multilingual provider quality and physical-device matrix remain manual.

## SideShift Reliable Core — 2026-07-23

- **Guaranteed baseline:** debates complete through **Reliable Core** (deterministic on-device engine) without hosted AI, Worker, or provider credentials.
- **Optional enhancement:** hosted SideShift AI (Groq primary, Cloudflare Workers AI fallback) improves naturalness when online and configured.
- **Router:** `src/lib/debateEngine/` tries hosted enhancement with a deadline, then falls back to Reliable Core automatically.
- **Contract:** `generateDebateTurn` / `evaluateDebate` with `engineMode`, `engineVersion`, tactic metadata persisted on opponent turns.
- **Verification:** `npm run verify:reliable-core` (29 Vitest cases across Reliable Core + router).
- **Android APK:** `android/app/build/outputs/apk/debug/app-debug.apk` includes Reliable Core in web assets (no on-device LLM download).
- Physical device offline matrix and full browser E2E remain manual.

## SideShift AI platform — 2026-07-23

- **Replaced** user-facing SideShift Basic with **SideShift AI** and a provider-agnostic Worker router.
- **Primary:** Groq `openai/gpt-oss-120b` (requires `GROQ_API_KEY` secret on Worker).
- **Fallback:** Cloudflare Workers AI `@cf/qwen/qwen3-30b-a3b-fp8`.
- Reliability: bounded retry (1/provider), jitter, circuit breaker, idempotent quota RPCs, normalized evaluation schema with legacy API mapping.
- Benchmark harness: `npm run benchmark:ai` (mock); live requires operator credentials.
- Gates: 41 Vitest files / 167 tests, typecheck, lint, worker tests (12), secret scan, production build, Android APK — all green in this pass.
- **Blocked for live Groq verification:** `GROQ_API_KEY` must be set via `wrangler secret put GROQ_API_KEY --env production` before deploy.
- Production Worker must be redeployed with new provider code; `ALLOWED_ORIGINS` must include real web origin + `https://localhost` for Android.
- Physical device matrix and full OTP→debate→evaluation browser journey remain manual.

## Interrupted debate recovery — 2026-07-23

- Root cause: hydration preferred `result.take` over an active debate’s `takeId`, desyncing evaluation motion from the saved transcript and causing evaluation retry loops.
- Fix: `resolveDebateTake()` restores debate-owned take; `ownedTakeIdRef` pins autosave; recovery screen offers resume/home/discard (discard clears only in-progress debate).
- Tests: `src/lib/debateRecovery.test.ts` (7 cases) + full suite 159 tests green.
- Worker verify: production `sideshift-basic-api.*.workers.dev` health OK, unauthenticated 401.
- Android APK: `android/app/build/outputs/apk/debug/app-debug.apk` built with Workers HTTPS endpoint.
- Browser E2E: not completed (dev API port conflict 8787 vs 8790; app stuck on Connecting during automated pass). Physical device matrix still required.

## Mobile UX and private-beta completeness — 2026-07-23

- Auth OTP: form submit on Enter, email validation before send, code-stage autofocus, guest-failure copy, Android Back on signed-out and onboarding.
- AI debate: offline guards on send/finish, Basic-specific rule note and setup simplification, min-length hint, retry-review label, sticky composer CSS, debate-focus hides bottom nav.
- Settings Help: beta feedback form, build/backend/AI facts, privacy links; debate vs interface language labels fixed.
- Gates: 39 Vitest files / 152 tests, typecheck, lint, worker tests, secret scan, and production build pass. Browser verified home → debate choice → Basic setup → send argument; full evaluation/result/logout browser pass blocked by pre-existing interrupted debate session. Physical Android matrix still pending.

## Production auth, hosted Basic, and mobile correction phase - 2026-07-21

- Signed-out welcome now has deliberate Continue as guest, Continue with email, and Learn about SideShift actions. Guest creation is explicit; email access uses six-digit OTP with `shouldCreateUser: true`, bounded resend, safe errors, and no raw provider details in UI.
- Active anonymous users can secure the same identity through Supabase email-change OTP. Profile, settings, debates, friends, Groups, leagues, points, preferences, and onboarding remain attached to the original user ID.
- The live onboarding route is three stages: Welcome, SideSwitch, and Personalize/start. The old debate-mode step is unreachable and its mode-choice copy was removed from the active translation set; mode selection remains after Start Debate.
- Group detail is now a compact header/actions/invite/tabs structure. Invite display is grouped, copy/share-safe, screen-reader readable, and keeps the stored secure token unchanged. Friends is one tabbed destination for Friends, Requests, and League.
- Added `worker/` with Wrangler configuration, Workers AI Qwen binding, Supabase bearer validation, existing quota/idempotency RPC reuse, scoped CORS, health/capability routes, and deployment verification scripts. Wrangler dry-run and local Worker boundary tests pass; production deployment and a real HTTPS URL are still pending authentication/deployment credentials.
- Verification after this phase: 35 Vitest files / 125 tests, typecheck, lint, encoding, PWA, frontend secret scan, dependency audit, production HTTPS-placeholder build, and Worker Wrangler dry-run pass. Android production APK re-test remains pending until the deployed Worker URL is configured.

## Final mobile structure and persistent logout - 2026-07-21

- Logout now persists a non-sensitive `sideshift-signed-out-v1` marker only after local Supabase sign-out succeeds. Bootstrap, auth callbacks, Capacitor resume, app restart, and private-state hydration respect it; no anonymous session is created from an empty session alone.
- `Continue as guest` is the only deliberate anonymous-session creation path after the signed-out welcome. It clears the marker, starts one bootstrap attempt, and keeps the marker if local storage cannot be cleared.
- App memory, local private state, draft keys, profile/avatar publication, and route state are cleared on signed-out transition. Android Back handlers return through nested screens and cannot restore the old private route after logout.
- Mobile ownership is contract-tested: Home/Explore own World Pulse, Friends owns Friends League, Groups owns Group League, Profile/Settings own avatar editing, and Settings owns account controls. The five bottom destinations remain Home, Explore, Friends, Groups, Profile.
- Settings uses focused sub-screens and a single localized sign-out dialog with retryable failure handling. Mobile CSS standardizes 16px form text, 44-48px controls, safe-area navigation, modal bottom sheets, destructive separation, and compact card hierarchy.
- Automated verification is green for 33 Vitest files / 114 tests, typecheck, lint, env, providers, encoding, PWA, secret scan, dependency audit, HTTPS-placeholder build, Capacitor sync, and Android debug APK compilation. Physical Android restart/logout/Back and visual viewport checks remain pending because `adb` and browser screenshot automation are unavailable.

## World Pulse and Private Debate League — 2026-07-20

- World Pulse uses reviewed, sourced items with translations, sensitivity, publication windows, source metadata, and immutable debate snapshots.
- The Explore World Pulse panel supports bounded region/category/sensitivity filtering, source links through the external-browser adapter, and sensitive-topic preferences.
- Private Friends and Group League panels use opt-in seasons, aggregate standings, personal point breakdowns, private awards, and leave controls without a new navigation destination.
- Migrations `0028`–`0032` add the World Pulse/editor and League schema/RPC boundary. Local and remote migrations now match through `0032`; migrations `0001`–`0027` were not edited.
- The linked World Pulse/League verifier passes published-item visibility, inactive/draft protection, editor-write denial, private Friends League join/dashboard behavior, forged-point denial, and invalid-activity idempotency.
- Physical Android interaction, visual viewport checks, and multi-user remote League privacy checks remain manual follow-up because `adb` is unavailable and anonymous-auth rate limits constrain additional test-user creation.

The Android mobile polish phase adds a phone-first typography/spacing contract, safe-area mobile navigation, a localized three-stage introduction, and a single profile-avatar snapshot with revisioned signed-image URLs. Profile & Settings 2.0 now adds a focused settings hub, viewer-aware profile detail, validated social links, selected safe statistics, preview controls, clickable human profile targets in Friends, Groups, and challenges, and anonymous-account logout protection. This repair keeps avatar editing in the owner Profile Settings flow, adds a WebView image-decoder fallback, and makes logout enter a signed-out welcome state without automatic anonymous re-authentication. Physical Android logout and media confirmation remains pending.

SideShift Basic now owns one guarded client turn pipeline: each round has a stable header-safe idempotency identity, retries reuse the same turn identity, stale responses are rejected, invalid responses become recoverable errors, and Android lifecycle backgrounding interrupts safely without losing the submitted argument.

Repository verification is green for typecheck, lint, 32 Vitest files / 106 tests, provider configuration, encoding, PWA checks, frontend secret scanning, dependency audit, development Vite build, Capacitor sync, Android debug APK compilation, and the four-viewer profile/RLS verifier. Physical Android installation/lifecycle/media/logout verification remains pending because `adb` is unavailable in this environment.

## Avatar RLS and Android build precondition repair — 2026-07-20

- Remote private avatar Storage now authorizes the canonical `<public_profile_key>/current.webp` path for owner insert, replacement/upsert, and removal without making the bucket public.
- Non-owner reads continue through the privacy-aware signed-URL boundary; the owner-only transition read permits Storage upsert before `profiles.avatar_path` metadata is linked.
- Remote migrations `0025`–`0027` are applied. The targeted private-social verifier passed owner write, replacement, friend signed read, outsider denial, and cleanup once after the repair.
- `android:build:verify` now supplies a process-only public HTTPS placeholder. Local Android development still uses the configured LAN URL, and production rejects HTTP/private addresses.
- The four-viewer profile/privacy verifier now passes owner, accepted friend, shared-Group member, outsider, hidden-field omission, and blocked-access coverage.
