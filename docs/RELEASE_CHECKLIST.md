# Release Checklist

## Automated

- [ ] Git status and expected diff
- [ ] SideShift AI Worker deploy with `GROQ_API_KEY`, `SUPABASE_*` secrets, and production `ALLOWED_ORIGINS`
- [ ] `npm run api:worker:verify -- <HTTPS_WORKER_URL>` reports `aiMode: sideshift-ai`
- [ ] `npm run benchmark:ai` or live benchmark with operator credentials
- [ ] Targeted regression tests
- [ ] Full unit tests
- [ ] Type-check
- [ ] Lint
- [ ] Production build
- [ ] Integration/database verification
- [ ] Secret scan
- [ ] Dependency audit

## Browser/manual

- [ ] Critical navigation and flows
- [ ] AI mock flow
- [ ] AI live flow
- [ ] Human challenge/two-user flow
- [ ] Refresh and recovery
- [ ] Loading/error/offline/unavailable states
- [ ] Keyboard/accessibility
- [ ] Responsive viewports
- [ ] PWA install/update/reconnect

## Physical device

- [ ] Android lifecycle
- [ ] Interrupted debate resume/discard on device
- [ ] Install debug APK from `android/app/build/outputs/apk/debug/app-debug.apk` and confirm SideShift AI reaches production Worker (PC dev server stopped)
- [ ] Logout → force-stop → reopen → signed-out welcome
- [ ] Android Back during active AI debate (no silent discard)
- [ ] OTP switch to email app and return
- [ ] Keyboard/safe-area/sticky composer on 320–412px widths
- [ ] Back button
- [ ] Deep links
- [ ] Share
- [ ] External browser
- [ ] Pause/resume persistence

## Documentation

- [ ] Current status accurate
- [ ] Known limitations explicit
- [ ] Release notes accurate
- [ ] Final diff reviewed
- [ ] Verdict recorded
