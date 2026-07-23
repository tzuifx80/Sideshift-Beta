# Known limitations

- **Multilingual debate behavior** (2026-07-24): Hosted SideShift AI supports many languages on a best-effort basis; only EN/DE/FR/ES/IT have authored Reliable Core offline composition. Auto language detection uses lightweight heuristics, not academic language ID. Live hosted multilingual naturalness requires operator credentials and manual human review; `npm run verify:debate-quality` covers deterministic and mocked contract checks only.

- **Reliable Core** is a deterministic debate engine, not a frontier LLM. It does not verify factual truth; local coaching scores are automated estimates, not moral or political judgments. Hosted SideShift AI may improve naturalness when available but is no longer required to start or finish a debate.

- Provider credentials (`GROQ_API_KEY`, Workers AI binding) are optional for private beta distribution. Debates fall back to Reliable Core automatically when enhancement is unavailable, rate-limited, malformed, or timed out.

- Automated browser E2E for offline Worker-down completion was not executed in this workspace pass. `npm run verify:reliable-core` covers the local three-round path; physical Android offline verification remains required.

- The persistent signed-out lifecycle is covered by deterministic regression tests and an Android debug APK build, but it has not been exercised on the confirmed physical phone. Retest logout, relaunch, resume, Back, and Continue as guest on-device before using `MOBILE_STRUCTURE_AND_LOGOUT_VERIFIED`.

- **SideShift AI** (formerly Basic) routes through the Cloudflare Worker with Groq primary and Workers AI fallback. Deploy requires `GROQ_API_KEY` plus existing Supabase secrets. API paths remain `/api/ai/basic/*` for compatibility.

- Hosted SideShift AI is implemented; production health was previously verified at `sideshift-basic-api.*.workers.dev`. After this provider upgrade, redeploy the Worker and re-run `npm run api:worker:verify -- <HTTPS_WORKER_URL>`.

- Interrupted debate recovery (2026-07-23): active debates now restore their original take after reload; stale `result.take` cannot override an in-progress debate; irrecoverable AI config shows a recovery screen instead of an evaluation retry loop. Discard removes only the broken in-progress debate.

- Full authenticated browser E2E (OTP → onboarding → Basic debate → evaluation → logout → re-login) was not completed in this workspace pass because the dev API proxy expected port 8787 while a prior API instance was bound to 8790, leaving the web app on “Connecting…”. Re-run `npm run dev:all` after freeing port 8787 for the manual pass.

- World Pulse editorial creation/editing is intentionally a minimal internal workspace; source and translation form editing is available through the server RPC boundary but not yet exposed as a full newsroom form.
- The initial World Pulse content is deterministic demonstration material, not a live-news feed. No automatic breaking-news ingestion or AI publication is enabled.
- Group League and completed-season award behavior are covered by schema/RPC compilation and domain tests; full multi-user remote Group privacy and season-expiry exercise remains a manual follow-up because anonymous-auth rate limits limit additional stable test-user creation.

- `npx supabase db lint --linked --fail-on error` still reports the pre-existing `pg_catalog.trim(text)` error in `complete_challenge_response` and an unused `p_points` warning; this repair did not alter those unrelated functions.

- `adb` is not installed in this workspace, so the debug APK could not be installed or exercised on an emulator/device.
- Physical Android gallery/camera, permission recovery, keyboard, rotation, Back, reconnect, deep-link and native-share checks remain manual.
- `npm run verify:providers:live` reaches the three-turn Basic and evaluation checks, then fails at the existing feedback-email delivery assertion (`delivery_status: failed` instead of `sent`).
- The exact production `npm run build` command is blocked by the intentionally local/private ignored API URL. A compile-only production build with a public HTTPS placeholder passed; no production endpoint was configured or claimed.
- Build warnings from Puter CommonJS interop and large chunks remain unchanged.
- Browser screenshot automation was unavailable in this workspace; target viewport evidence is therefore limited to static responsive contracts and successful builds. Manual 320/360/375/390/412px, Large Text, dark-mode, and multilingual visual checks remain required.
- A 2026-07-23 mobile UX pass added OTP form submit, Android Back on signed-out/onboarding, offline guards in AI debate, Basic-route setup honesty, settings Help feedback/version links, and debate-focus mobile nav hiding. Physical-device verification of keyboard overlap, safe areas, and Back behavior remains required.
- Dedicated native camera capture is not guaranteed: the installed Android project still contains only App, Browser, and Share Capacitor plugins. The avatar flow remains honest about system picker support.
- Email OTP unified signup/sign-in and guest account security are implemented. Supabase Dashboard sign-up, email OTP, manual identity linking, custom SMTP, and the OTP email template still require one-time configuration before the production beta flow can be considered end-to-end verified.
- The logout/avatar repair is covered by deterministic unit tests, but the physical Android system-picker, private Storage upload, restart persistence, and sign-out/relaunch checks remain pending because `adb` is unavailable here.
- Human profile targets in Friends, Groups, direct challenges, and completed friend-challenge rows now open the privacy-aware profile detail. The current debate history contains no human participant identity rows; AI opponents remain intentionally non-clickable.
- The preview selector uses the shared client visibility rules for simulated audiences; the actual profile route uses the server resolver. A separate owner-only “act as viewer” RPC was not added.
