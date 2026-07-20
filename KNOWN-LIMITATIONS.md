# Known limitations

- `adb` is not installed in this workspace, so the debug APK could not be installed or exercised on an emulator/device.
- Physical Android gallery/camera, permission recovery, keyboard, rotation, Back, reconnect, deep-link and native-share checks remain manual.
- `npm run verify:providers:live` reaches the three-turn Basic and evaluation checks, then fails at the existing feedback-email delivery assertion (`delivery_status: failed` instead of `sent`).
- The exact production `npm run build` command is blocked by the intentionally local/private ignored API URL. A compile-only production build with a public HTTPS placeholder passed; no production endpoint was configured or claimed.
- Build warnings from Puter CommonJS interop and large chunks remain unchanged.
