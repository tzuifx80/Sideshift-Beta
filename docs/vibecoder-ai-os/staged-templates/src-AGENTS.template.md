# Frontend/Application Boundary

- Keep navigation ownership in the existing navigation/router layer.
- Keep state in the established owner; do not duplicate source-of-truth state.
- Preserve persistence schema and migrations.
- Handle loading, empty, offline, unavailable, and error states.
- Preserve selected content, drafts, debate state, and refresh recovery.
- Use existing design tokens, themes, typography, and shared components.
- Keep mock/live labels accurate.
- Maintain keyboard access, visible focus, semantics, and responsive behavior.
- Reuse shared localization and formatting logic.
- Add behavior-focused regression tests.
- Do not copy AI, persistence, or challenge logic into components.
