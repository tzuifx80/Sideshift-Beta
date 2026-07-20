# Known limitations

- The four-viewer profile/privacy verifier could not be rerun after the avatar policy repair because Supabase anonymous-auth rate limiting activated; the targeted private-social verifier passed once after the repair, and no further anonymous signups were attempted.
- `npx supabase db lint --linked --fail-on error` still reports the pre-existing `pg_catalog.trim(text)` error in `complete_challenge_response` and an unused `p_points` warning; this repair did not alter those unrelated functions.

- `adb` is not installed in this workspace, so the debug APK could not be installed or exercised on an emulator/device.
- Physical Android gallery/camera, permission recovery, keyboard, rotation, Back, reconnect, deep-link and native-share checks remain manual.
- `npm run verify:providers:live` reaches the three-turn Basic and evaluation checks, then fails at the existing feedback-email delivery assertion (`delivery_status: failed` instead of `sent`).
- The exact production `npm run build` command is blocked by the intentionally local/private ignored API URL. A compile-only production build with a public HTTPS placeholder passed; no production endpoint was configured or claimed.
- Build warnings from Puter CommonJS interop and large chunks remain unchanged.
- Browser screenshot automation was unavailable in this workspace; target viewport evidence is therefore limited to static responsive contracts and successful builds. Manual 320/360/375/390/412px, Large Text, dark-mode, and multilingual visual checks remain required.
- Dedicated native camera capture is not guaranteed: the installed Android project still contains only App, Browser, and Share Capacitor plugins. The avatar flow remains honest about system picker support.
- Email/OAuth account upgrade/linking is not configured in the current Supabase beta. Account Security therefore identifies the anonymous/not-recoverable state and protects sign-out with explicit confirmation rather than claiming a recovery method.
- The logout/avatar repair is covered by deterministic unit tests, but the physical Android system-picker, private Storage upload, restart persistence, and sign-out/relaunch checks remain pending because `adb` is unavailable here.
- Human profile targets in Friends, Groups, direct challenges, and completed friend-challenge rows now open the privacy-aware profile detail. The current debate history contains no human participant identity rows; AI opponents remain intentionally non-clickable.
- The preview selector uses the shared client visibility rules for simulated audiences; the actual profile route uses the server resolver. A separate owner-only “act as viewer” RPC was not added.
