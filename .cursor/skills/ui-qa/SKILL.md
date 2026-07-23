---
name: ui-qa
description: Reviews SideShift UI for responsive layout, accessibility, localization overflow, and honest state handling. Use for screen changes, onboarding, debate flows, settings, or Android layout issues.
---

# UI QA

## Checklist

- **Widths**: ~320px mobile, tablet, desktop.
- **Android**: safe areas, Back navigation (Friends/Groups nested), keyboard overlap.
- **Accessibility**: focus visibility, keyboard operation, accessible names, reduced motion.
- **Localization**: German and other locales for overflow/wrapping; no hardcoded strings.
- **States**: loading, empty, offline, unavailable, error, reconnecting — all honest.
- **Visual**: design tokens from `src/theme.ts`; no unrelated redesign drift.
- **Interaction**: no dead ends; AI labelled mock vs live accurately.

## Procedure

1. Identify changed screens and shared components.
2. Walk the primary user path at each breakpoint.
3. Note missing states or misleading success UI.
4. Recommend smallest fixes; do not expand scope.

## Evidence required

- Viewports/surfaces checked.
- Issues with severity and file references.
- Manual device gaps called out explicitly.

## Stop conditions

- No blocking UX/accessibility issues for the stated acceptance criteria, or
- Issues documented with reproduction steps for Implementer.

## Key references

- Components: `src/components/SideShiftUI.tsx`
- Mobile: `src/ui/mobileDesign.ts`, `src/mobileArchitecture.ts`
- i18n: `src/i18n/`
- Tests: `src/mobileDesign.test.ts`, Playwright scripts in `scripts/`
