# SideShift private-beta device test

Run this after deployment with the final HTTPS URL. Record pass/fail, device/browser version, and the deployment commit.

## Windows desktop

- Open the HTTPS URL in Chrome or Edge.
- Confirm `/api/health` reports `private-beta`, `supabase`, and the expected AI mode.
- Complete onboarding, start a debate, refresh during an active round, and confirm the draft returns.
- Complete a full debate and confirm the result, Shift Card, PNG download, caption copy, and native share where supported.
- Open Profile and verify Privacy, Beta Terms, Community Rules, and Delete my beta data are visible.
- Create a Friend Clash link, open it in a private browser window, answer once, and confirm the creator sees the response.
- Disconnect Wi-Fi, confirm the offline banner, confirm server-dependent actions are paused, reconnect, and complete the flow.
- Use the browser install action if offered; confirm the installed app opens the same HTTPS origin.

## Android Chrome and installed PWA

- Open the HTTPS URL in Chrome on Android and verify the install prompt or browser-menu install path.
- Install SideShift, open it from the home screen, and confirm the standalone layout, icon, manifest name, and no blank screen on reload.
- With the device offline, open a previously visited page and confirm the offline fallback is shown; confirm no `/api` or Supabase response is served from cache.
- Reconnect, complete onboarding/debate/challenge flows, and verify native share includes the PNG when the OS supports file sharing.

## Second person / private browser

- Use a second phone or private browser with a separate anonymous session.
- Open the challenge URL directly, confirm it deep-links into the challenge view, and submit one response.
- Attempt a second response and confirm the single-use error.
- Confirm the creator’s private starting stance is not in the shared card or challenge page.

## Data and deletion

- In the responder session, delete beta data and confirm the creator still sees the completed challenge but the responder identity is not shown.
- In the creator session, delete beta data and confirm profile, preferences, debates, results, challenges, reports, and rate-limit records are removed.
- Confirm the anonymous auth session is signed out/reset after deletion and that a fresh session starts cleanly.

## Release gate

Record these commands and their outputs before inviting users:

```powershell
npm run test:production-smoke
npm run test:pwa
npm run audit:frontend-secrets
npm audit --omit=dev
```

Live AI is a separate optional check. If `AI_PROVIDER=mock`, the beta UI must visibly disclose that replies and scores are simulations.
