# Android/Capacitor Boundary

- Keep web code and Capacitor source configuration as the primary source of truth.
- Do not edit generated native output when source configuration owns the behavior.
- Preserve lifecycle pause/resume, back-button, deep-link, browser, share, and persistence behavior.
- Run verified sync/build commands after source changes.
- Separate automated web checks, Android build checks, emulator checks, and physical-device checks.
- Never claim physical-device verification unless it occurred.
